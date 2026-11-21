"use client";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Clapperboard, Heart, MessageCircle, Play, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { compact, EmptyState, Spinner, TimeAgo, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { PostModal } from "@/components/post/post-modal";
import { ShareButton } from "@/components/post/share-menu";
import { errorMessage, get, post as apiPost } from "@/lib/api";
import type { Post, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Page = { reels: Post[]; hasMore: boolean; locked: boolean };
const videoOf = (p: Post) => p.media.find((m) => m.type === "video")?.url ?? "";

/** Profile "Reels" tab: every video the person posted (identity posts only), as a 9:16 grid. */
export function ReelsTab({ p }: { p: Profile }) {
  const { user: me } = useAuth();
  const [open, setOpen] = useState<number | null>(null);
  const key = ["reels", p.username.toLowerCase(), me?.id ?? "anon"];
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => get<Page>(`/users/${p.username}/reels?page=${pageParam}&limit=24`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
  });
  const reels = q.data?.pages.flatMap((pg) => pg.reels) ?? [];

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="mb-4 font-sans text-lg font-bold tracking-normal">Reels</h2>
      {q.isLoading && <Spinner className="size-5" />}
      {!q.isLoading && reels.length === 0 && (
        <EmptyState icon={<Clapperboard className="size-8" />} title="No reels yet">
          {p.isMe ? "Videos you share in identity posts will appear here as reels." : `Videos ${p.displayName.split(" ")[0]} shares will appear here.`}
        </EmptyState>
      )}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {reels.map((r, i) => <ReelThumb key={r.id} reel={r} onOpen={() => setOpen(i)} />)}
      </div>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-accent">
            {q.isFetchingNextPage ? "Loading…" : "See more reels"}
          </button>
        </div>
      )}
      <AnimatePresence>
        {open !== null && reels.length > 0 && (
          <ReelViewer
            reels={reels}
            start={open}
            queryKey={key}
            onClose={() => setOpen(null)}
            onNeedMore={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Grid tile: a frame from the video; plays a silent preview on hover (desktop). */
function ReelThumb({ reel, onOpen }: { reel: Post; onOpen: () => void }) {
  const v = useRef<HTMLVideoElement>(null);
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => void v.current?.play().catch(() => {})}
      onMouseLeave={() => { if (v.current) { v.current.pause(); v.current.currentTime = 0.5; } }}
      onContextMenu={(e) => e.preventDefault()}
      className="group relative aspect-[9/16] overflow-hidden rounded-md bg-zinc-900 sm:rounded-lg"
      aria-label="Open reel"
    >
      <video ref={v} src={`${videoOf(reel)}#t=0.5`} muted loop playsInline preload="metadata" disablePictureInPicture className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <span className="absolute top-2 right-2 text-white drop-shadow"><Clapperboard className="size-4" /></span>
      <span className="absolute bottom-2 left-2 flex items-center gap-3 text-[13px] font-semibold text-white drop-shadow">
        <span className="flex items-center gap-1"><Play className="size-3.5 fill-current" /></span>
        {reel.likesCount > 0 && <span className="flex items-center gap-1"><Heart className="size-3.5 fill-current" /> {compact(reel.likesCount)}</span>}
      </span>
    </button>
  );
}

/** Full-screen vertical reel viewer: swipe/scroll or ↑/↓ between reels, tap to pause. */
function ReelViewer({ reels, start, queryKey, onClose, onNeedMore }: {
  reels: Post[]; start: number; queryKey: unknown[]; onClose: () => void; onNeedMore: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const [muted, setMuted] = useState(false);

  // Jump to the tapped reel, lock page scroll
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: start * el.clientHeight });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [start]);

  // Track which reel is on screen
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll("[data-i]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [reels.length]);

  useEffect(() => { if (active >= reels.length - 3) onNeedMore(); }, [active, reels.length, onNeedMore]);

  const go = (d: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: Math.min(Math.max(active + d, 0), reels.length - 1) * el.clientHeight, behavior: "smooth" });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); go(-1); }
      if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black" role="dialog" aria-label="Reels">
      <div ref={scroller} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {reels.map((r, i) => (
          <div key={r.id} data-i={i} className="flex h-full snap-start snap-always items-center justify-center">
            <Reel reel={r} active={i === active} near={Math.abs(i - active) <= 1} muted={muted} setMuted={setMuted} queryKey={queryKey} onClose={onClose} />
          </div>
        ))}
      </div>

      <button onClick={onClose} className="absolute top-4 left-4 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20" aria-label="Close reels">
        <X className="size-6" />
      </button>
      {/* Desktop up/down */}
      <div className="absolute top-1/2 right-6 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button onClick={() => go(-1)} disabled={active === 0} className="grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 disabled:opacity-30" aria-label="Previous reel"><ChevronUp className="size-6" /></button>
        <button onClick={() => go(1)} disabled={active === reels.length - 1} className="grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 disabled:opacity-30" aria-label="Next reel"><ChevronDown className="size-6" /></button>
      </div>
    </motion.div>
  );
}

function Reel({ reel, active, near, muted, setMuted, queryKey, onClose }: {
  reel: Post; active: boolean; near: boolean; muted: boolean; setMuted: (m: boolean) => void; queryKey: unknown[]; onClose: () => void;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(0);

  // Only the reel on screen plays; it restarts from the beginning when you come back to it
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      el.play().catch(() => { el.muted = true; setMuted(true); void el.play().catch(() => {}); });
    } else el.pause();
  }, [active, setMuted]);

  const patch = (fn: (p: Post) => Post) =>
    qc.setQueryData<InfiniteData<Page>>(queryKey, (d) => d && { ...d, pages: d.pages.map((pg) => ({ ...pg, reels: pg.reels.map((x) => (x.id === reel.id ? fn(x) : x)) })) });
  const like = async () => {
    if (!user) return router.push("/login");
    const was = reel.likedByMe;
    patch((p) => ({ ...p, likedByMe: !was, likesCount: p.likesCount + (was ? -1 : 1) }));
    if (!was) setBurst((b) => b + 1);
    try {
      const r = await apiPost<{ liked: boolean; likesCount: number }>(`/posts/${reel.id}/like`);
      patch((p) => ({ ...p, likedByMe: r.liked, likesCount: r.likesCount }));
    } catch (e) {
      patch((p) => ({ ...p, likedByMe: was, likesCount: p.likesCount + (was ? 1 : -1) }));
      toast.error(errorMessage(e));
    }
  };
  const togglePlay = () => {
    const el = v.current;
    if (!el) return;
    if (el.paused) { void el.play(); setPaused(false); } else { el.pause(); setPaused(true); }
  };

  const a = reel.author;
  return (
    <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-zinc-950 sm:h-[94dvh] sm:rounded-2xl">
      {near && (
        <video
          ref={v}
          src={videoOf(reel)}
          loop
          playsInline
          muted={muted}
          preload="auto"
          controls={false}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onDoubleClick={() => !reel.likedByMe && like()}
          onTimeUpdate={(e) => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
          className="size-full cursor-pointer object-contain"
        />
      )}

      <AnimatePresence>
        {paused && active && (
          <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="pointer-events-none absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Play className="ml-1 size-9 fill-current" />
          </motion.span>
        )}
        {burst > 0 && (
          <motion.span key={burst} initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-pink-500">
            <Heart className="size-24 fill-current drop-shadow-xl" />
          </motion.span>
        )}
      </AnimatePresence>

      <button onClick={() => setMuted(!muted)} className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60" aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      {/* Bottom: author + caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-24 pb-5 pr-20 text-white">
        {a && (
          <Link href={`/profile/${a.username}`} onClick={onClose} className="pointer-events-auto flex w-fit items-center gap-2.5">
            <UserAvatar src={a.avatarUrl} name={a.displayName} className="size-9 ring-2 ring-white/70" />
            <span className="font-semibold">{a.displayName}</span>
            {a.isVerified && <VerifiedMark />}
            <span className="text-xs text-white/70">· <TimeAgo date={reel.createdAt} /></span>
          </Link>
        )}
        {reel.content && (
          <button onClick={() => setExpanded((x) => !x)} className={cn("pointer-events-auto mt-2 block text-left text-[14px] leading-snug break-words whitespace-pre-wrap", !expanded && "line-clamp-2")}>
            {reel.content}
          </button>
        )}
      </div>

      {/* Right action rail */}
      <div className="absolute right-2.5 bottom-6 flex flex-col items-center gap-5 text-white [&_button]:drop-shadow-md">
        <button onClick={like} className="flex flex-col items-center gap-1" aria-label="Like" aria-pressed={reel.likedByMe}>
          <motion.span key={String(reel.likedByMe)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur">
            <Heart className={cn("size-6", reel.likedByMe && "fill-pink-500 text-pink-500")} />
          </motion.span>
          <span className="text-xs font-semibold">{reel.likesCount > 0 ? compact(reel.likesCount) : "Like"}</span>
        </button>
        <button onClick={() => { v.current?.pause(); setPaused(true); setCommentsOpen(true); }} className="flex flex-col items-center gap-1" aria-label="Comments">
          <span className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur"><MessageCircle className="size-6" /></span>
          <span className="text-xs font-semibold">{reel.commentsCount > 0 ? compact(reel.commentsCount) : "Comment"}</span>
        </button>
        <div className="flex flex-col items-center gap-1 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:p-0 [&>button]:text-white [&>button]:backdrop-blur [&>button_svg]:size-6">
          <ShareButton post={reel} />
          <span className="text-xs font-semibold">Share</span>
        </div>
      </div>

      {/* Progress */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
        <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
      </div>

      {commentsOpen && <PostModal post={reel} open={commentsOpen} onOpenChange={setCommentsOpen} />}
    </div>
  );
}
