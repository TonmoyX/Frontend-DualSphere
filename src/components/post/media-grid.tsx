"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/common/video-player";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/types";

/** An image on a soft backdrop made from a blurred copy of itself, so narrow/tall photos still fill the frame nicely. */
function FramedImage({ src, single, onOpen }: { src: string; single: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="relative block size-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
      {single && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden loading="lazy" className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl saturate-150 dark:opacity-45" />
          <span className="absolute inset-0 bg-white/30 dark:bg-black/30" aria-hidden />
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn("relative mx-auto size-full", single ? "max-h-[620px] min-h-[220px] object-contain" : "object-cover")}
      />
    </button>
  );
}

/**
 * Post media.
 *  bleed → full card width with no rounded corners/border (feed & post page)
 *  default → inset, rounded (embedded previews)
 */
export function MediaGrid({ media, bleed = false }: { media: Media[]; bleed?: boolean }) {
  const [open, setOpen] = useState<Media | null>(null);
  if (!media.length) return null;
  const n = media.length;
  const shown = media.slice(0, 4);
  return (
    <>
      <div className={cn("grid gap-0.5 overflow-hidden", n === 1 ? "grid-cols-1" : "grid-cols-2", bleed ? "border-y border-black/[0.04] dark:border-white/[0.04]" : "mt-3 rounded-xl border")}>
        {shown.map((m, i) => (
          <div
            key={m.url}
            className={cn("relative", n === 1 ? "" : "aspect-square", n === 3 && i === 0 && "row-span-2 aspect-auto")}
          >
            {m.type === "video" ? (
              <VideoPlayer src={m.url} fill={n > 1} className={cn("bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900", n > 1 && "size-full")} />
            ) : (
              <FramedImage src={m.url} single={n === 1} onOpen={() => setOpen(m)} />
            )}
            {i === 3 && n > 4 && (
              <button type="button" onClick={() => setOpen(m)} className="absolute inset-0 grid place-items-center bg-black/55 text-3xl font-bold text-white">
                +{n - 4}
              </button>
            )}
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none sm:max-w-5xl" showCloseButton>
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {open && <img src={open.url} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
