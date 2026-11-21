"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const MAX = 60; // the page only ever sinks this far

/** iOS-style rubber band: easy at first, then stiffer, never past MAX. */
const rubber = (dy: number) => MAX * (1 - Math.exp(-dy / 220));

/**
 * Pulling down at the top of the page makes the content sink a little and spring back on release.
 * The navbar (outside this wrapper) stays fixed. No refresh — purely a feel thing.
 * Works with touch and with a trackpad (only for gestures that start at the top).
 */
export function ElasticPull({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (disabled) return;
    const set = (v: number) => { offsetRef.current = v; setOffset(v); };
    const atTop = () => window.scrollY <= 0;
    const blocked = () => document.body.style.overflow === "hidden" || !!document.querySelector("[role=dialog][data-state=open], [aria-modal=true]");
    const release = () => { setDragging(false); set(0); };

    // Touch
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      startY = e.touches.length === 1 && atTop() && !blocked() ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || !atTop()) { if (offsetRef.current) set(0); return; }
      e.preventDefault(); // keep the browser from bouncing/reloading the whole page (navbar included)
      setDragging(true);
      set(rubber(dy));
    };
    const onEnd = () => { if (startY !== null) { startY = null; release(); } };

    // Trackpad: two-finger scroll up while already at the top.
    // Trackpads keep sending "momentum" events for ~1s after the fingers lift, so the pull is a short one-shot:
    // it follows the gesture briefly, then springs back and ignores the rest of that gesture (no hanging).
    let acc = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let startedAtTop = false;
    let done = false;
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - last > 200) { startedAtTop = atTop(); done = false; acc = 0; } // a new gesture
      last = now;
      if (done || e.ctrlKey || blocked() || !startedAtTop || !atTop() || e.deltaY >= 0) return;
      acc += -e.deltaY;
      setDragging(true);
      set(rubber(acc * 0.5));
      if (!timer) {
        timer = setTimeout(() => { timer = null; done = true; release(); }, 180);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("wheel", onWheel);
      if (timer) clearTimeout(timer);
    };
  }, [disabled]);

  return (
    <div
      style={{
        transform: offset ? `translate3d(0, ${offset}px, 0)` : undefined,
        transition: dragging ? "transform 60ms linear" : "transform 450ms cubic-bezier(.22,1,.36,1)", // smooth ease-out back up, no overshoot
      }}
    >
      {children}
    </div>
  );
}
