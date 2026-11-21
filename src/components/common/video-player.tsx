"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Settings, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/**
 * Custom video player: play/pause, seek, time, ⚙ settings (quality + playback speed), mute, fullscreen.
 * No download button, no right-click "Save video as…", no picture-in-picture menu.
 * (Determined users can still capture a stream — this removes the built-in ways.)
 */
export function VideoPlayer({ src, className, videoClassName, fill = false }: { src: string; className?: string; videoClassName?: string; fill?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [volOpen, setVolOpen] = useState(false); // vertical slider (hover on desktop, tap on touch)
  const [volDrag, setVolDrag] = useState(false);
  const volTrack = useRef<HTMLDivElement>(null);
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef<string>("mouse");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [height, setHeight] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [menu, setMenu] = useState<null | "main" | "speed" | "quality">(null);
  const [scrub, setScrub] = useState<number | null>(null); // 0..1 while dragging
  const [hover, setHover] = useState<number | null>(null); // 0..1 hover position on the bar

  // Controls auto-hide while playing
  const poke = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (video.current && !video.current.paused) setShowUi(false);
    }, 2500);
  }, []);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Only one video plays at a time across the page
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== video.current) video.current?.pause(); };
    window.addEventListener("ds:video-play", onOther);
    return () => window.removeEventListener("ds:video-play", onOther);
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (menu) { setMenu(null); return; } // first click just closes the settings menu
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      void v.play();
    } else v.pause();
    poke();
  };
  const seekTo = (frac: number) => {
    const v = video.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(Math.max(frac, 0), 1) * duration;
    setTime(v.currentTime);
  };
  const skip = (d: number) => video.current && seekTo((video.current.currentTime + d) / (duration || 1));
  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.5;
    } else v.muted = true;
  };
  const setVolume = (val: number) => {
    const v = video.current;
    if (!v) return;
    const x = Math.round(Math.min(Math.max(val, 0), 1) * 100) / 100;
    v.volume = x;
    v.muted = x === 0;
    try { localStorage.setItem("ds-video-volume", String(x)); } catch {}
  };
  const volAt = (clientY: number) => {
    const r = volTrack.current!.getBoundingClientRect();
    return 1 - (clientY - r.top) / r.height;
  };
  // Remember the viewer's volume between videos
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("ds-video-volume"));
      if (video.current && saved > 0 && saved <= 1) video.current.volume = saved;
    } catch {}
  }, []);
  const keepVolOpen = () => {
    if (volTimer.current) clearTimeout(volTimer.current);
    setVolOpen(true);
  };
  const closeVolSoon = (ms = 400) => {
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => setVolOpen(false), ms);
  };
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  };
  const setRate = (r: number) => {
    if (video.current) video.current.playbackRate = r;
    setSpeed(r);
    setMenu("main");
  };

  const fracAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
  };
  const onBarDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setScrub(fracAt(e.clientX));
  };
  const onBarMove = (e: React.PointerEvent) => {
    const f = fracAt(e.clientX);
    setHover(f);
    if (scrub !== null) setScrub(f);
  };
  const onBarUp = (e: React.PointerEvent) => {
    if (scrub === null) return;
    seekTo(fracAt(e.clientX));
    setScrub(null);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowright") { e.preventDefault(); skip(5); }
    else if (k === "arrowleft") { e.preventDefault(); skip(-5); }
    else if (k === "m") toggleMute();
    else if (k === "arrowup") { e.preventDefault(); setVolume((video.current?.muted ? 0 : (video.current?.volume ?? 1)) + 0.1); keepVolOpen(); closeVolSoon(1200); }
    else if (k === "arrowdown") { e.preventDefault(); setVolume((video.current?.muted ? 0 : (video.current?.volume ?? 1)) - 0.1); keepVolOpen(); closeVolSoon(1200); }
    else if (k === "f") toggleFs();
    else return;
    poke();
  };

  const progress = scrub ?? (duration ? time / duration : 0);
  const uiVisible = showUi || !playing || menu !== null || scrub !== null || volOpen;
  const level = muted ? 0 : volume;
  const VolIcon = level === 0 ? VolumeX : level < 0.34 ? Volume : level < 0.67 ? Volume1 : Volume2;
  const quality = height ? `${height}p` : "";

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onMouseLeave={() => { setHover(null); if (playing) setShowUi(false); }}
      onContextMenu={(e) => e.preventDefault()} // no "Save video as…"
      className={cn("group/vp relative select-none overflow-hidden bg-black outline-none", fullscreen && "grid place-items-center", className)}
    >
      <video
        ref={video}
        src={src}
        playsInline
        preload="metadata"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onClick={toggle}
        onDoubleClick={toggleFs}
        onPlay={() => { setPlaying(true); setStarted(true); setEnded(false); window.dispatchEvent(new CustomEvent("ds:video-play", { detail: video.current })); poke(); }}
        onPause={() => { setPlaying(false); setShowUi(true); }}
        onEnded={() => { setPlaying(false); setEnded(true); setShowUi(true); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setHeight(e.currentTarget.videoHeight); }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length && v.duration) setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
        }}
        onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolumeState(e.currentTarget.volume); }}
        className={cn("block w-full cursor-pointer", fullscreen ? "max-h-screen object-contain" : fill ? "size-full object-cover" : "max-h-[620px] object-contain", videoClassName)}
      />

      {/* Big centre button before the first play / after it ends */}
      <AnimatePresence>
        {(!started || ended) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            onClick={toggle}
            className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-2 ring-white/80 backdrop-blur-sm transition-transform hover:scale-105"
            aria-label={ended ? "Replay" : "Play"}
          >
            {ended ? <RotateCcw className="size-7" /> : <Play className="ml-1 size-7 fill-current" />}
          </motion.button>
        )}
      </AnimatePresence>

      {waiting && playing && <Loader2 className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/90" />}

      {/* Settings menu */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 bottom-14 z-20 flex max-h-[calc(100%-4.25rem)] w-[min(15rem,calc(100%-1rem))] flex-col overflow-hidden rounded-xl bg-black/85 py-1.5 text-[14px] text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
          >
            {menu === "main" && (
              <>
                <button onClick={() => setMenu("quality")} className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-white/10">
                  <span className="flex-1 text-left font-semibold">Quality</span>
                  <span className="text-white/75">Automatic{quality && ` ${quality}`}</span>
                  <ChevronRight className="size-4 text-white/75" />
                </button>
                <button onClick={() => setMenu("speed")} className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-white/10">
                  <span className="flex-1 text-left font-semibold">Playback speed</span>
                  <span className="text-white/75">{speed === 1 ? "Normal" : `${speed}×`}</span>
                  <ChevronRight className="size-4 text-white/75" />
                </button>
              </>
            )}
            {menu === "speed" && (
              <>
                <button onClick={() => setMenu("main")} className="flex w-full shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 font-semibold hover:bg-white/10">
                  <ChevronLeft className="size-4" /> Playback speed
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                  {SPEEDS.map((r) => (
                    <button key={r} ref={speed === r ? (el) => el?.scrollIntoView({ block: "center" }) : undefined} onClick={() => setRate(r)} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-white/10">
                      <span className="w-5">{speed === r && <Check className="size-4" />}</span>
                      <span className="flex-1 text-left">{r === 1 ? "Normal" : `${r}×`}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {menu === "quality" && (
              <>
                <button onClick={() => setMenu("main")} className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 font-semibold hover:bg-white/10">
                  <ChevronLeft className="size-4" /> Quality
                </button>
                <button onClick={() => setMenu("main")} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-white/10">
                  <span className="w-5"><Check className="size-4" /></span>
                  <span className="flex-1 text-left">Automatic{quality && ` (${quality})`}</span>
                </button>
                <p className="px-4 pt-1 pb-1.5 text-xs text-white/55">Plays at the best quality this video was uploaded in.</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control bar */}
      <motion.div
        animate={{ opacity: uiVisible ? 1 : 0, y: uiVisible ? 0 : 8 }}
        transition={{ duration: 0.18 }}
        className={cn("absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-2 text-white", !uiVisible && "pointer-events-none")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={toggle} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
          </button>
          <span className="shrink-0 text-[13px] font-medium tabular-nums">
            <span className="font-semibold">{fmt(scrub !== null ? scrub * duration : time)}</span>
            <span className="text-white/80"> / {fmt(duration)}</span>
          </span>

          {/* Seek bar */}
          <div
            ref={bar}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerLeave={() => setHover(null)}
            className="group/bar relative mx-1 flex h-6 min-w-0 flex-1 cursor-pointer items-center"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
          >
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/bar:h-1.5">
              <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${buffered * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${progress * 100}%` }} />
            </div>
            <span
              className={cn("absolute size-3.5 -translate-x-1/2 rounded-full bg-white shadow transition-transform", scrub !== null ? "scale-100" : "scale-0 group-hover/bar:scale-100")}
              style={{ left: `${progress * 100}%` }}
            />
            {hover !== null && duration > 0 && (
              <span className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] tabular-nums" style={{ left: `${hover * 100}%` }}>
                {fmt(hover * duration)}
              </span>
            )}
          </div>

          <button
            onClick={() => setMenu((m) => (m ? null : "main"))}
            className={cn("grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15", menu && "bg-white/15")}
            aria-label="Settings"
            aria-expanded={!!menu}
          >
            <Settings className={cn("size-5 transition-transform duration-300", menu && "rotate-45")} />
          </button>
          <button onClick={toggleFs} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
          {/* Volume: vertical slider pops up above the speaker */}
          <div
            className="relative shrink-0"
            onMouseEnter={() => lastPointer.current === "mouse" && keepVolOpen()}
            onMouseLeave={() => !volDrag && closeVolSoon()}
          >
            <AnimatePresence>
              {volOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 justify-center overflow-hidden rounded-full bg-white/[0.14] px-2.5 py-3 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.55),inset_0_-1px_1px_rgba(255,255,255,0.12),0_10px_30px_-6px_rgba(0,0,0,0.45)] ring-1 ring-white/25 backdrop-blur-2xl backdrop-saturate-[1.8]"
                >
                  {/* liquid-glass sheen: bright top edge fading down */}
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/35 via-white/[0.06] to-white/[0.02]" />
                  <div
                    ref={volTrack}
                    role="slider"
                    aria-label="Volume"
                    aria-orientation="vertical"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(level * 100)}
                    tabIndex={0}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      setVolDrag(true);
                      keepVolOpen();
                      setVolume(volAt(e.clientY));
                    }}
                    onPointerMove={(e) => volDrag && setVolume(volAt(e.clientY))}
                    onPointerUp={(e) => {
                      setVolDrag(false);
                      if (e.pointerType !== "mouse") closeVolSoon(1800);
                    }}
                    className="relative h-24 w-5 cursor-pointer touch-none"
                  >
                    <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 overflow-hidden rounded-full bg-white/30 shadow-[inset_0_1px_1px_rgba(0,0,0,0.25)]">
                      <div className="absolute inset-x-0 bottom-0 rounded-full bg-blue-500" style={{ height: `${level * 100}%` }} />
                    </div>
                    <span
                      className={cn("absolute left-1/2 size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow-md transition-transform", volDrag && "scale-125")}
                      style={{ bottom: `${level * 100}%` }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
              onClick={() => {
                // Touch: first tap opens the slider; mouse: click mutes/unmutes (slider opens on hover)
                if (lastPointer.current !== "mouse" && !volOpen) { keepVolOpen(); closeVolSoon(2500); return; }
                toggleMute();
              }}
              className="grid size-9 place-items-center rounded-full hover:bg-white/15"
              aria-label={level === 0 ? "Unmute" : "Mute"}
            >
              <VolIcon className="size-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
