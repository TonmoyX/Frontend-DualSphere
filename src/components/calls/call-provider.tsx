"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/bits";
import { get } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Kind = "audio" | "video";
type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";
interface Peer { id: string; displayName: string; avatarUrl: string | null; username?: string }
interface CallInfo { callId: string | null; conversationId: string; peer: Peer; kind: Kind; direction: "out" | "in" }

interface Ctx {
  startCall: (conversationId: string, peer: Peer, kind: Kind) => void;
  busy: boolean;
}
const CallCtx = createContext<Ctx>({ startCall: () => {}, busy: false });
export const useCall = () => useContext(CallCtx);

// ── tones (generated, no audio files) ─────────────────────────────
function tone(pattern: "ring" | "ringback") {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  let stopped = false;
  const beep = (freqs: number[], ms: number) => {
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    gain.connect(ctx.destination);
    const oscs = freqs.map((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gain); o.start(); return o; });
    setTimeout(() => oscs.forEach((o) => o.stop()), ms);
  };
  const cycle = () => {
    if (stopped) return;
    if (pattern === "ring") { beep([523, 659], 350); setTimeout(() => !stopped && beep([523, 659], 350), 500); }
    else beep([440, 480], 1500);
  };
  cycle();
  const t = setInterval(cycle, pattern === "ring" ? 2200 : 4000);
  return () => { stopped = true; clearInterval(t); ctx.close().catch(() => {}); };
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [call, setCall] = useState<CallInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [endText, setEndText] = useState("");

  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const remote = useRef<MediaStream | null>(null);
  const localEl = useRef<HTMLVideoElement>(null);
  const remoteEl = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const stopTone = useRef<() => void>(() => {});
  const callRef = useRef<CallInfo | null>(null);
  const startedAt = useRef(0);
  // Single source of truth for the active call (state for rendering, ref for event handlers)
  const updateCall = useCallback((next: CallInfo | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const attach = useCallback(() => {
    if (localEl.current && local.current) localEl.current.srcObject = local.current;
    if (remoteEl.current && remote.current) remoteEl.current.srcObject = remote.current;
    if (remoteAudio.current && remote.current) remoteAudio.current.srcObject = remote.current;
  }, []);

  const cleanup = useCallback(() => {
    stopTone.current();
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    remote.current = null;
    pendingIce.current = [];
    setMuted(false);
    setCameraOn(false);
    setRemoteVideo(false);
  }, []);

  const finish = useCallback((text: string) => {
    cleanup();
    setEndText(text);
    setPhase("ended");
    setTimeout(() => { setPhase("idle"); updateCall(null); setElapsed(0); }, 1600);
  }, [cleanup, updateCall]);

  const signal = (data: unknown) => {
    const c = callRef.current;
    if (c?.callId) getSocket().emit("call:signal", { callId: c.callId, data });
  };

  const getMedia = async (kind: Kind) => {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: kind === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
    });
    local.current = s;
    setCameraOn(kind === "video");
    attach();
    return s;
  };

  const createPc = async () => {
    const { iceServers } = await get<{ iceServers: RTCIceServer[] }>("/calls/config").catch(() => ({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }));
    const conn = new RTCPeerConnection({ iceServers });
    pc.current = conn;
    remote.current = new MediaStream();
    local.current?.getTracks().forEach((t) => conn.addTrack(t, local.current!));
    conn.onicecandidate = (e) => e.candidate && signal({ type: "ice", candidate: e.candidate.toJSON() });
    conn.ontrack = (e) => {
      remote.current!.addTrack(e.track);
      if (e.track.kind === "video") setRemoteVideo(true);
      e.track.onended = () => e.track.kind === "video" && setRemoteVideo(false);
      attach();
    };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === "connected") {
        stopTone.current();
        if (!startedAt.current) startedAt.current = Date.now();
        setPhase("active");
      }
      if (conn.connectionState === "failed") {
        toast.error("Call connection failed. You may need a TURN server on this network.");
        const c = callRef.current;
        if (c?.callId) getSocket().emit("call:end", { callId: c.callId });
      }
    };
    return conn;
  };

  const flushIce = async () => {
    for (const c of pendingIce.current) await pc.current?.addIceCandidate(c).catch(() => {});
    pendingIce.current = [];
  };

  // ── outgoing ──
  const startCall = useCallback(async (conversationId: string, peer: Peer, kind: Kind) => {
    if (callRef.current) return toast.info("You're already in a call");
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Calls aren't supported in this browser");
    try {
      updateCall({ callId: null, conversationId, peer, kind, direction: "out" });
      setPhase("outgoing");
      startedAt.current = 0;
      await getMedia(kind);
      const r = await new Promise<{ callId?: string; error?: string }>((res) => getSocket().emit("call:invite", { conversationId, kind }, res));
      if (r.error || !r.callId) { finish(r.error ?? "Call failed"); return; }
      const current = callRef.current as CallInfo | null;
      if (current) updateCall({ ...current, callId: r.callId });
      stopTone.current = tone("ringback");
    } catch (e) {
      finish(e instanceof Error && e.name === "NotAllowedError" ? "Microphone/camera permission denied" : "Couldn't start the call");
    }
  }, [finish, updateCall]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── incoming ──
  const accept = async () => {
    const c = callRef.current;
    if (!c?.callId) return;
    stopTone.current();
    try {
      setPhase("connecting");
      await getMedia(c.kind);
      await createPc();
      getSocket().emit("call:accept", { callId: c.callId });
    } catch (e) {
      getSocket().emit("call:reject", { callId: c.callId });
      finish(e instanceof Error && e.name === "NotAllowedError" ? "Microphone/camera permission denied" : "Couldn't join the call");
    }
  };
  const decline = () => {
    const c = callRef.current;
    if (c?.callId) getSocket().emit("call:reject", { callId: c.callId });
    finish("Call declined");
  };
  const hangUp = () => {
    const c = callRef.current;
    if (c?.callId) getSocket().emit("call:end", { callId: c.callId });
    else finish("Call cancelled");
  };

  // ── in-call controls ──
  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCamera = async () => {
    const conn = pc.current;
    const existing = local.current?.getVideoTracks()[0];
    if (existing) {
      // Camera off: stop the track entirely (the light turns off)
      existing.stop();
      local.current!.removeTrack(existing);
      const sender = conn?.getSenders().find((s) => s.track === existing || s.track?.kind === "video");
      if (sender) await sender.replaceTrack(null);
      setCameraOn(false);
      signal({ type: "camera", on: false });
      return;
    }
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      const track = v.getVideoTracks()[0];
      local.current?.addTrack(track);
      attach();
      setCameraOn(true);
      const sender = conn?.getSenders().find((s) => s.track === null || s.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
      else if (conn) {
        // Upgrading a voice call to video → renegotiate
        conn.addTrack(track, local.current!);
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        signal({ type: "offer", sdp: offer });
      }
      signal({ type: "camera", on: true });
    } catch {
      toast.error("Couldn't turn on the camera");
    }
  };

  // ── socket events ──
  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    const onIncoming = (p: { callId: string; conversationId: string; kind: Kind; from: Peer }) => {
      if (callRef.current) return; // server handles busy for the caller
      startedAt.current = 0;
      updateCall({ callId: p.callId, conversationId: p.conversationId, peer: p.from, kind: p.kind, direction: "in" });
      setPhase("incoming");
      stopTone.current = tone("ring");
    };
    const onAccepted = async ({ callId }: { callId: string }) => {
      if (callRef.current?.callId !== callId) return;
      stopTone.current();
      setPhase("connecting");
      const conn = await createPc();
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      signal({ type: "offer", sdp: offer });
    };
    const onSignal = async ({ callId, data }: { callId: string; data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; on?: boolean } }) => {
      if (callRef.current?.callId !== callId) return;
      const conn = pc.current;
      if (data.type === "camera") { if (!data.on) setRemoteVideo(false); return; }
      if (!conn) return;
      if (data.type === "offer" && data.sdp) {
        await conn.setRemoteDescription(data.sdp);
        await flushIce();
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        signal({ type: "answer", sdp: answer });
      } else if (data.type === "answer" && data.sdp) {
        await conn.setRemoteDescription(data.sdp);
        await flushIce();
      } else if (data.type === "ice" && data.candidate) {
        if (conn.remoteDescription) await conn.addIceCandidate(data.candidate).catch(() => {});
        else pendingIce.current.push(data.candidate);
      }
    };
    const onEnded = ({ callId, reason, duration }: { callId: string; reason: string; duration: number }) => {
      if (callRef.current?.callId !== callId) return;
      const out = callRef.current.direction === "out";
      finish(
        reason === "ended" ? `Call ended · ${fmt(duration)}`
        : reason === "declined" ? (out ? "Call declined" : "Call ended")
        : reason === "busy" ? "User is busy"
        : out ? "No answer" : "Missed call",
      );
    };
    const onHandled = ({ callId, by }: { callId: string; by: string }) => {
      // Answered on another of my tabs/devices → stop ringing here
      if (callRef.current?.callId === callId && by !== s.id && phase === "incoming") { cleanup(); setPhase("idle"); updateCall(null); }
    };
    s.on("call:incoming", onIncoming);
    s.on("call:accepted", onAccepted);
    s.on("call:signal", onSignal);
    s.on("call:ended", onEnded);
    s.on("call:handled", onHandled);
    return () => {
      s.off("call:incoming", onIncoming);
      s.off("call:accepted", onAccepted);
      s.off("call:signal", onSignal);
      s.off("call:ended", onEnded);
      s.off("call:handled", onHandled);
    };
  }, [user, finish, cleanup, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Call timer
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Re-attach streams when the overlay re-renders video elements
  useEffect(attach, [attach, phase, cameraOn, remoteVideo]);

  // Hang up if the tab closes mid-call
  useEffect(() => {
    const bye = () => { const c = callRef.current; if (c?.callId) getSocket().emit("call:end", { callId: c.callId }); };
    window.addEventListener("beforeunload", bye);
    return () => window.removeEventListener("beforeunload", bye);
  }, []);

  const status =
    phase === "outgoing" ? (call?.callId ? "Ringing…" : "Calling…")
    : phase === "incoming" ? `Incoming ${call?.kind === "video" ? "video" : "voice"} call`
    : phase === "connecting" ? "Connecting…"
    : phase === "active" ? fmt(elapsed)
    : endText;
  const showVideo = phase === "active" && remoteVideo;

  return (
    <CallCtx.Provider value={{ startCall, busy: phase !== "idle" }}>
      {children}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />
      <AnimatePresence>
        {phase !== "idle" && call && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-gradient-to-b from-[#1b1740] via-[#0f1020] to-black text-white"
            role="dialog"
            aria-label="Call"
          >
            {/* Remote video (full screen) */}
            <video ref={remoteEl} autoPlay playsInline className={cn("absolute inset-0 size-full bg-black object-cover", showVideo ? "opacity-100" : "opacity-0")} />
            {showVideo && <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />}

            {/* Local preview (PiP) */}
            {cameraOn && (
              <motion.video
                drag
                dragMomentum={false}
                ref={localEl}
                autoPlay
                playsInline
                muted
                className={cn(
                  "absolute z-10 rounded-2xl border-2 border-white/20 bg-black object-cover shadow-2xl [transform:scaleX(-1)]",
                  phase === "active" ? "top-4 right-4 h-44 w-32 sm:h-56 sm:w-40" : "inset-0 size-full rounded-none border-0 opacity-40",
                )}
              />
            )}

            {/* Header / avatar */}
            <div className={cn("relative z-[5] flex flex-col items-center text-center", showVideo ? "pt-6" : "flex-1 justify-center")}>
              {!showVideo && (
                <div className="relative mb-6">
                  {(phase === "outgoing" || phase === "incoming") && (
                    <>
                      <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
                      <span className="absolute -inset-4 animate-pulse rounded-full bg-white/5" />
                    </>
                  )}
                  <UserAvatar src={call.peer.avatarUrl} name={call.peer.displayName} className="relative size-32 text-3xl ring-4 ring-white/10 sm:size-40" />
                </div>
              )}
              <h2 className="text-2xl font-bold drop-shadow sm:text-3xl">{call.peer.displayName}</h2>
              <p className={cn("mt-1 text-sm text-white/75 tabular-nums drop-shadow", phase === "ended" && "text-base text-white")}>{status}</p>
              {phase === "active" && muted && <p className="mt-1 text-xs text-white/60">You&apos;re muted</p>}
            </div>

            {/* Controls */}
            <div className={cn("relative z-[5] flex items-center justify-center gap-5 px-6 pb-10 sm:gap-8", showVideo && "mt-auto")}>
              {phase === "incoming" ? (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={decline} className="grid size-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/30 transition-transform hover:scale-105" aria-label="Decline">
                      <PhoneOff className="size-7" />
                    </button>
                    <span className="text-xs text-white/70">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <motion.button
                      onClick={accept}
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="grid size-16 place-items-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
                      aria-label="Accept"
                    >
                      {call.kind === "video" ? <Video className="size-7" /> : <Phone className="size-7" />}
                    </motion.button>
                    <span className="text-xs text-white/70">Accept</span>
                  </div>
                </>
              ) : phase !== "ended" ? (
                <>
                  <button onClick={toggleMute} className={cn("grid size-14 place-items-center rounded-full backdrop-blur transition-colors", muted ? "bg-white text-black" : "bg-white/15 hover:bg-white/25")} aria-label={muted ? "Unmute" : "Mute"}>
                    {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                  </button>
                  <button
                    onClick={toggleCamera}
                    disabled={phase !== "active" && phase !== "outgoing"}
                    className={cn("grid size-14 place-items-center rounded-full backdrop-blur transition-colors disabled:opacity-40", cameraOn ? "bg-white text-black" : "bg-white/15 hover:bg-white/25")}
                    aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
                  >
                    {cameraOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
                  </button>
                  <button onClick={hangUp} className="grid size-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/30 transition-transform hover:scale-105" aria-label="End call">
                    <PhoneOff className="size-7" />
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CallCtx.Provider>
  );
}
