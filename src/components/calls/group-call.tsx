"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/bits";
import { get } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { tone } from "./call-provider";

/**
 * Group voice/video calls (mesh WebRTC, up to 8 people). Everyone joins AS THEMSELVES — names and photos are
 * always shown, even in groups where messages can be sent anonymously.
 */
type Kind = "audio" | "video";
export interface CallUser { id: string; username?: string; displayName: string; avatarUrl: string | null }
export interface GroupCallState { callId: string; kind: Kind; participants: CallUser[] }
interface Ring { callId: string; conversationId: string; kind: Kind; title: string | null; from: CallUser }
interface Active { callId: string; conversationId: string; kind: Kind; title: string }
interface Tile { user: CallUser; stream: MediaStream; video: boolean; muted: boolean; connected: boolean }
interface PeerConn { pc: RTCPeerConnection; stream: MediaStream; pendingIce: RTCIceCandidateInit[] }

interface Ctx {
  start: (conversationId: string, title: string, kind: Kind) => void;
  join: (callId: string, conversationId: string, title: string, kind: Kind) => void;
  active: Active | null;
  /** Running call per group (from the server), for "Join call" banners. */
  calls: Record<string, GroupCallState | null>;
  watch: (conversationId: string) => void;
}
const GroupCallCtx = createContext<Ctx>({ start: () => {}, join: () => {}, active: null, calls: {}, watch: () => {} });
export const useGroupCall = () => useContext(GroupCallCtx);

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
type Ack = { callId?: string; conversationId?: string; kind?: Kind; participants?: CallUser[]; error?: string };
type Signal = { type: "offer" | "answer" | "ice" | "state"; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; muted?: boolean; video?: boolean };

export function GroupCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<Active | null>(null);
  const [ring, setRing] = useState<Ring | null>(null);
  const [tiles, setTiles] = useState<Record<string, Tile>>({});
  const [calls, setCalls] = useState<Record<string, GroupCallState | null>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const activeRef = useRef<Active | null>(null);
  const local = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, PeerConn>());
  const iceServers = useRef<RTCIceServer[] | null>(null);
  const stopTone = useRef<() => void>(() => {});
  const startedAt = useRef(0);
  const localEl = useRef<HTMLVideoElement>(null);

  const setActiveCall = (a: Active | null) => { activeRef.current = a; setActive(a); };
  const patchTile = (id: string, fn: (t: Tile) => Tile) => setTiles((all) => (all[id] ? { ...all, [id]: fn(all[id]) } : all));

  const signal = (to: string, data: Signal) => {
    const a = activeRef.current;
    if (a) getSocket().emit("gcall:signal", { callId: a.callId, to, data });
  };

  const servers = async () => {
    if (!iceServers.current) {
      iceServers.current = (await get<{ iceServers: RTCIceServer[] }>("/calls/config").catch(() => ({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }))).iceServers;
    }
    return iceServers.current;
  };

  /** One RTCPeerConnection per other participant. */
  const connectTo = async (u: CallUser) => {
    const existing = peers.current.get(u.id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: await servers() });
    const stream = new MediaStream();
    const conn: PeerConn = { pc, stream, pendingIce: [] };
    peers.current.set(u.id, conn);
    local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
    pc.onicecandidate = (e) => e.candidate && signal(u.id, { type: "ice", candidate: e.candidate.toJSON() });
    pc.ontrack = (e) => {
      stream.addTrack(e.track);
      if (e.track.kind === "video") patchTile(u.id, (t) => ({ ...t, video: true }));
      setTiles((all) => (all[u.id] ? { ...all, [u.id]: { ...all[u.id], stream } } : all));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        patchTile(u.id, (t) => ({ ...t, connected: true }));
        if (!startedAt.current) startedAt.current = Date.now();
        // Tell the newcomer whether I'm muted / on camera
        signal(u.id, { type: "state", muted: !local.current?.getAudioTracks()[0]?.enabled, video: !!local.current?.getVideoTracks()[0] });
      }
    };
    setTiles((all) => ({ ...all, [u.id]: all[u.id] ?? { user: u, stream, video: false, muted: false, connected: false } }));
    return conn;
  };

  const dropPeer = (id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setTiles((all) => { const next = { ...all }; delete next[id]; return next; });
  };

  const cleanup = useCallback(() => {
    stopTone.current();
    peers.current.forEach((p) => p.pc.close());
    peers.current.clear();
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    setTiles({});
    setMuted(false);
    setCameraOn(false);
    setElapsed(0);
    startedAt.current = 0;
    setActiveCall(null);
  }, []);

  const getMedia = async (kind: Kind) => {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: kind === "video" ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
    });
    local.current = s;
    setCameraOn(kind === "video");
    if (localEl.current) localEl.current.srcObject = s;
  };

  /** After the server accepts me into the call: offer to everyone already there. */
  const enter = async (r: Ack, title: string) => {
    if (r.error || !r.callId || !r.conversationId || !r.kind) {
      cleanup();
      toast.error(r.error ?? "Couldn't join the call");
      return;
    }
    setActiveCall({ callId: r.callId, conversationId: r.conversationId, kind: r.kind, title });
    for (const u of r.participants ?? []) {
      const { pc } = await connectTo(u);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal(u.id, { type: "offer", sdp: offer });
    }
  };

  const begin = async (emitName: "gcall:start" | "gcall:join", payload: object, title: string, kind: Kind) => {
    if (activeRef.current) return toast.info("You're already in a call");
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Calls aren't supported in this browser");
    try {
      stopTone.current();
      setRing(null);
      // Placeholder so the screen opens immediately
      setActiveCall({ callId: "", conversationId: "", kind, title });
      await getMedia(kind);
      const r = await new Promise<Ack>((res) => getSocket().emit(emitName, payload, res));
      await enter(r, title);
    } catch (e) {
      cleanup();
      toast.error(e instanceof Error && e.name === "NotAllowedError" ? "Allow microphone/camera access to join calls" : "Couldn't join the call");
    }
  };

  const start = useCallback((conversationId: string, title: string, kind: Kind) => void begin("gcall:start", { conversationId, kind }, title, kind), []); // eslint-disable-line react-hooks/exhaustive-deps
  const join = useCallback((callId: string, _conversationId: string, title: string, kind: Kind) => void begin("gcall:join", { callId }, title, kind), []); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => {
    const a = activeRef.current;
    if (a?.callId) getSocket().emit("gcall:leave", { callId: a.callId });
    cleanup();
  };

  const watch = useCallback((conversationId: string) => {
    getSocket().emit("gcall:status", { conversationId }, (r: Ack) =>
      setCalls((all) => ({ ...all, [conversationId]: r.callId ? { callId: r.callId, kind: r.kind!, participants: r.participants ?? [] } : null })),
    );
  }, []);

  // ── controls ──
  const broadcastState = (patch: { muted?: boolean; video?: boolean }) => {
    const state = { muted: patch.muted ?? muted, video: patch.video ?? cameraOn };
    peers.current.forEach((_p, id) => signal(id, { type: "state", ...state }));
  };
  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    broadcastState({ muted: next });
  };
  const toggleCamera = async () => {
    const existing = local.current?.getVideoTracks()[0];
    if (existing) {
      existing.stop();
      local.current!.removeTrack(existing);
      for (const { pc } of peers.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track === existing);
        if (sender) await sender.replaceTrack(null);
      }
      setCameraOn(false);
      broadcastState({ video: false });
      return;
    }
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = v.getVideoTracks()[0];
      local.current?.addTrack(track);
      if (localEl.current) localEl.current.srcObject = local.current;
      setCameraOn(true);
      for (const [id, { pc }] of peers.current) {
        const sender = pc.getSenders().find((s) => s.track === null || s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        else {
          // Voice call → video: renegotiate with this person
          pc.addTrack(track, local.current!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signal(id, { type: "offer", sdp: offer });
        }
      }
      broadcastState({ video: true });
    } catch {
      toast.error("Couldn't turn on the camera");
    }
  };

  // ── socket events ──
  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    const onRing = (r: Ring) => {
      if (activeRef.current) return;
      setRing(r);
      stopTone.current();
      stopTone.current = tone("ring");
      setTimeout(() => setRing((cur) => { if (cur?.callId === r.callId) { stopTone.current(); return null; } return cur; }), 45_000);
    };
    const onHandled = ({ callId, by }: { callId: string; by: string }) => {
      if (by === s.id) return;
      setRing((cur) => { if (cur?.callId === callId) { stopTone.current(); return null; } return cur; });
    };
    const onState = (p: { conversationId: string; callId: string | null; kind?: Kind; participants?: CallUser[] }) => {
      setCalls((all) => ({ ...all, [p.conversationId]: p.callId ? { callId: p.callId, kind: p.kind!, participants: p.participants ?? [] } : null }));
      if (!p.callId) setRing((cur) => { if (cur?.conversationId === p.conversationId) { stopTone.current(); return null; } return cur; });
    };
    const onPeerJoined = async ({ callId, user: u }: { callId: string; user: CallUser }) => {
      if (activeRef.current?.callId !== callId) return;
      await connectTo(u); // the newcomer sends the offer
    };
    const onPeerLeft = ({ callId, userId }: { callId: string; userId: string }) => {
      if (activeRef.current?.callId === callId) dropPeer(userId);
    };
    const onSignal = async ({ callId, from, data }: { callId: string; from: string; data: Signal }) => {
      if (activeRef.current?.callId !== callId) return;
      if (data.type === "state") { patchTile(from, (t) => ({ ...t, muted: !!data.muted, video: !!data.video })); return; }
      let conn = peers.current.get(from);
      if (!conn && data.type === "offer") {
        const info = calls[activeRef.current.conversationId]?.participants.find((p) => p.id === from);
        conn = await connectTo(info ?? { id: from, displayName: "Member", avatarUrl: null });
      }
      if (!conn) return;
      const { pc } = conn;
      if (data.type === "offer" && data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        for (const c of conn.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal(from, { type: "answer", sdp: answer });
      } else if (data.type === "answer" && data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        for (const c of conn.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } else if (data.type === "ice" && data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
        else conn.pendingIce.push(data.candidate);
      }
    };
    const onEnded = ({ callId }: { callId: string }) => {
      if (activeRef.current?.callId === callId) { cleanup(); toast("Call ended"); }
    };
    s.on("gcall:ring", onRing);
    s.on("gcall:handled", onHandled);
    s.on("gcall:state", onState);
    s.on("gcall:peer-joined", onPeerJoined);
    s.on("gcall:peer-left", onPeerLeft);
    s.on("gcall:signal", onSignal);
    s.on("gcall:ended", onEnded);
    return () => {
      s.off("gcall:ring", onRing);
      s.off("gcall:handled", onHandled);
      s.off("gcall:state", onState);
      s.off("gcall:peer-joined", onPeerJoined);
      s.off("gcall:peer-left", onPeerLeft);
      s.off("gcall:signal", onSignal);
      s.off("gcall:ended", onEnded);
    };
  }, [user, calls, cleanup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer (from the first connection)
  useEffect(() => {
    if (!active?.callId) return;
    const t = setInterval(() => startedAt.current && setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [active?.callId]);

  // Keep the local preview attached when the grid re-renders
  useEffect(() => {
    if (localEl.current && local.current) localEl.current.srcObject = local.current;
  });

  // Leave if the tab closes
  useEffect(() => {
    const bye = () => { const a = activeRef.current; if (a?.callId) getSocket().emit("gcall:leave", { callId: a.callId }); };
    window.addEventListener("beforeunload", bye);
    return () => window.removeEventListener("beforeunload", bye);
  }, []);

  const declineRing = () => {
    if (ring) getSocket().emit("gcall:decline", { callId: ring.callId });
    stopTone.current();
    setRing(null);
  };

  const others = Object.values(tiles);
  const count = others.length + 1;
  const cols = count <= 1 ? "grid-cols-1" : count <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <GroupCallCtx.Provider value={{ start, join, active, calls, watch }}>
      {children}

      {/* Incoming ring */}
      <AnimatePresence>
        {ring && !active && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 z-[210] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border bg-card p-4 shadow-2xl"
            role="dialog"
            aria-label="Incoming group call"
          >
            <div className="flex items-center gap-3">
              <span className="relative">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <UserAvatar src={ring.from.avatarUrl} name={ring.from.displayName} className="relative size-12" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ring.title || "Group call"}</p>
                <p className="truncate text-sm text-muted-foreground">{ring.from.displayName} started a {ring.kind === "video" ? "video" : "voice"} call</p>
              </div>
            </div>
            <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">You&apos;ll join as yourself — everyone in the call sees your name and photo.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={declineRing} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600">
                <PhoneOff className="size-4" /> Decline
              </button>
              <button onClick={() => join(ring.callId, ring.conversationId, ring.title || "Group call", ring.kind)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-green-500 px-4 text-sm font-semibold text-white hover:bg-green-600">
                {ring.kind === "video" ? <Video className="size-4" /> : <Phone className="size-4" />} Join
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-call screen */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-[#1b1740] via-[#0f1020] to-black text-white"
            role="dialog"
            aria-label="Group call"
          >
            <div className="flex items-center gap-3 px-5 pt-5">
              <span className="grid size-10 place-items-center rounded-full bg-white/10"><Users className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">{active.title}</h2>
                <p className="text-sm text-white/70 tabular-nums">
                  {!active.callId ? "Connecting…" : others.length === 0 ? "Waiting for others to join…" : `${count} in call · ${fmt(elapsed)}`}
                </p>
              </div>
            </div>

            <div className={cn("grid flex-1 gap-3 overflow-y-auto p-4 sm:p-6", cols)}>
              {/* Me */}
              <TileView name="You" avatarUrl={user?.avatarUrl ?? null} video={cameraOn} muted={muted} mirrored>
                <video ref={localEl} autoPlay playsInline muted className={cn("absolute inset-0 size-full object-cover [transform:scaleX(-1)]", !cameraOn && "hidden")} />
              </TileView>
              {others.map((t) => <RemoteTile key={t.user.id} t={t} />)}
            </div>

            <div className="flex items-center justify-center gap-5 px-6 pb-8 sm:gap-8">
              <button onClick={toggleMute} className={cn("grid size-14 place-items-center rounded-full backdrop-blur transition-colors", muted ? "bg-white text-black" : "bg-white/15 hover:bg-white/25")} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
              <button onClick={toggleCamera} disabled={!active.callId} className={cn("grid size-14 place-items-center rounded-full backdrop-blur transition-colors disabled:opacity-40", cameraOn ? "bg-white text-black" : "bg-white/15 hover:bg-white/25")} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}>
                {cameraOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
              </button>
              <button onClick={leave} className="grid size-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/30 transition-transform hover:scale-105" aria-label="Leave call">
                <PhoneOff className="size-7" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GroupCallCtx.Provider>
  );
}

function TileView({ name, avatarUrl, video, muted, connecting, children }: { name: string; avatarUrl: string | null; video: boolean; muted: boolean; connecting?: boolean; mirrored?: boolean; children?: ReactNode }) {
  return (
    <div className="relative grid min-h-40 place-items-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      {children}
      {!video && <UserAvatar src={avatarUrl} name={name} className="size-20 text-2xl sm:size-24" />}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur">
        {muted && <MicOff className="size-3.5 text-red-400" />}
        <span className="max-w-36 truncate">{name}</span>
        {connecting && <span className="text-white/60">· connecting…</span>}
      </div>
    </div>
  );
}

function RemoteTile({ t }: { t: Tile }) {
  const videoEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoEl.current) videoEl.current.srcObject = t.stream;
    if (audioEl.current) audioEl.current.srcObject = t.stream;
  });
  return (
    <TileView name={t.user.displayName} avatarUrl={t.user.avatarUrl} video={t.video} muted={t.muted} connecting={!t.connected}>
      <audio ref={audioEl} autoPlay playsInline className="hidden" />
      <video ref={videoEl} autoPlay playsInline muted className={cn("absolute inset-0 size-full object-cover", !t.video && "hidden")} />
    </TileView>
  );
}
