"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 300; // 5 minutes per voice message
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/** Records a voice note with live input levels (for the waveform). */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const raf = useRef<number>(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const resolveStop = useRef<((r: { blob: Blob; duration: number; mime: string } | null) => void) | null>(null);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (tick.current) clearInterval(tick.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close().catch(() => {});
    stream.current = null;
    audioCtx.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) throw new Error("Voice recording isn't supported in this browser");
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    stream.current = s;
    const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
    chunks.current = [];
    cancelled.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const duration = (Date.now() - started.current) / 1000;
      const type = (r.mimeType || mime || "audio/webm").split(";")[0];
      const blob = new Blob(chunks.current, { type });
      cleanup();
      resolveStop.current?.(cancelled.current || duration < 0.5 ? null : { blob, duration, mime: type });
      resolveStop.current = null;
    };
    // Live level meter
    const ctx = new AudioContext();
    audioCtx.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(s).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 90) {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevels((l) => [...l.slice(-47), Math.min(1, peak / 64)]);
        last = t;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    r.start(250);
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    setLevels([]);
    setRecording(true);
    tick.current = setInterval(() => {
      const sec = (Date.now() - started.current) / 1000;
      setSeconds(sec);
      if (sec >= MAX_SECONDS) rec.current?.stop();
    }, 200);
  }, [cleanup]);

  /** Stop and get the recording (null if cancelled or too short). */
  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; duration: number; mime: string } | null>((resolve) => {
        if (!rec.current || rec.current.state === "inactive") return resolve(null);
        resolveStop.current = resolve;
        rec.current.stop();
      }),
    [],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    else cleanup();
  }, [cleanup]);

  useEffect(() => () => { cancelled.current = true; rec.current?.state === "recording" && rec.current.stop(); cleanup(); }, [cleanup]);

  return { recording, seconds, levels, start, stop, cancel, max: MAX_SECONDS };
}

/** Stable pseudo-random waveform per message (we don't store real peaks). */
function bars(seed: string, n = 36) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345 + i) >>> 0;
    return 0.25 + ((h >>> 8) % 1000) / 1333;
  });
}

/** Telegram-style voice message: ▶ + waveform + time + speed. */
export function VoicePlayer({ url, duration, seed, mine }: { url: string; duration?: number; seed: string; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(duration ?? 0);
  const [rate, setRate] = useState(1);
  const wave = bars(seed);
  const progress = len ? Math.min(1, pos / len) : 0;

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      // pause any other voice note that's playing
      document.querySelectorAll<HTMLAudioElement>("audio[data-voice]").forEach((x) => x !== a && x.pause());
      void a.play();
    } else a.pause();
  };

  return (
    <div className="flex w-[240px] max-w-full items-center gap-2.5 py-0.5">
      <audio
        ref={audio}
        data-voice
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLen(e.currentTarget.duration)}
      />
      <button
        onClick={toggle}
        className={cn("grid size-10 shrink-0 place-items-center rounded-full", mine ? "bg-white text-primary" : "bg-primary text-primary-foreground")}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-[2px]"
          onClick={(e) => {
            const a = audio.current;
            if (!a || !len) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * len;
            setPos(a.currentTime);
          }}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(len)}
          aria-valuenow={Math.round(pos)}
        >
          {wave.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] shrink-0 rounded-full transition-colors",
                i / wave.length < progress ? (mine ? "bg-white" : "bg-primary") : mine ? "bg-white/40" : "bg-primary/30",
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <div className={cn("mt-0.5 flex items-center gap-2 text-[11px]", mine ? "text-white/80" : "text-muted-foreground")}>
          <span className="tabular-nums">{fmt(playing || pos ? pos : len)}</span>
          <button
            onClick={() => {
              const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
              setRate(next);
              if (audio.current) audio.current.playbackRate = next;
            }}
            className={cn("rounded-full px-1.5 font-semibold", mine ? "bg-white/20" : "bg-primary/10 text-primary")}
            aria-label="Playback speed"
          >
            {rate}×
          </button>
        </div>
      </div>
    </div>
  );
}

/** Live recording bar shown in the composer. */
export function RecordingBar({ seconds, levels, max }: { seconds: number; levels: number[]; max: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      <span className="w-12 shrink-0 text-sm font-medium tabular-nums">{fmt(seconds)}</span>
      <div className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
        {levels.map((l, i) => (
          <span key={i} className="w-[3px] shrink-0 rounded-full bg-primary" style={{ height: `${Math.max(10, l * 100)}%` }} />
        ))}
      </div>
      {seconds > max - 15 && <span className="shrink-0 text-xs text-destructive">{Math.ceil(max - seconds)}s left</span>}
    </div>
  );
}

export { fmt as formatDuration };
