"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Globe, MoreHorizontal, Pause, Play, SendHorizontal, Trash2, Users, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar, VerifiedMark } from "@/components/common/bits";
import { AnimatedEmoji } from "@/components/messages/animated-emoji";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { del, errorMessage, get, post } from "@/lib/api";
import type { StoryGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

const IMAGE_MS = 5000;
const STORY_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

/** Full-screen story viewer: progress bars, tap to navigate, hold to pause, react, send a message. */
export function StoryViewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => {
    const g = groups[start];
    const firstUnseen = g?.stories.findIndex((s) => !s.seen) ?? 0;
    return firstUnseen > 0 ? firstUnseen : 0;
  });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  const [bursts, setBursts] = useState<{ key: number; emoji: string; x: number }[]>([]); // fly-up reaction animations
  const burstKey = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group = groups[gi];
  const story = group?.stories[si];
  const halted = paused || viewersOpen || replyFocused || reply.length > 0;

  const next = useCallback(() => {
    setProgress(0);
    if (!group) return onClose();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }, [gi, si, group, groups.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { const pg = groups[gi - 1]; setGi(gi - 1); setSi(pg.stories.length - 1); }
  }, [gi, si, groups]);

  // Mark as seen
  useEffect(() => {
    if (!story || group.isMe || story.seen) return;
    post(`/stories/${story.id}/view`).then(() => qc.invalidateQueries({ queryKey: ["stories"] })).catch(() => {});
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance timer for images/text (videos drive progress from playback)
  useEffect(() => {
    if (!story || story.kind === "video" || halted) return;
    const startAt = Date.now() - progress * IMAGE_MS;
    const t = setInterval(() => {
      const p = (Date.now() - startAt) / IMAGE_MS;
      if (p >= 1) { clearInterval(t); next(); } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
  }, [story?.id, halted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (halted) v.pause(); else void v.play().catch(() => {});
  }, [halted, story?.id]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Reaction: stays on the story (only the author sees it, in the viewers list). Nothing goes to messages.
  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => post(`/stories/${id}/react`, { emoji }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sendReaction = (emoji: string, btn: HTMLElement) => {
    if (!story) return;
    const row = btn.parentElement!.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const key = ++burstKey.current;
    setBursts((cur) => [...cur, { key, emoji, x: b.left - row.left + b.width / 2 }]);
    react.mutate({ id: story.id, emoji });
  };
  // Message: goes to the author's inbox with a preview of the story
  const sendReply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => post(`/stories/${id}/reply`, { content }),
    onSuccess: () => { toast.success("Message sent"); setReply(""); qc.invalidateQueries({ queryKey: ["dm"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/stories/${story!.id}`),
    onSuccess: () => { toast.success("Story deleted"); qc.invalidateQueries({ queryKey: ["stories"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const viewers = useQuery({
    queryKey: ["stories", "viewers", story?.id],
    queryFn: async () => (await get<{ viewers: { id: string; username: string; displayName: string; avatarUrl: string | null; reaction: string | null; viewedAt: string }[] }>(`/stories/${story!.id}/viewers`)).viewers,
    enabled: !!story && group.isMe, // also feeds the avatar stack in the footer
  });

  if (!group || !story) return null;

  // Tap left third = previous, otherwise next; press-and-hold pauses
  const onPointerDown = () => { holdTimer.current = setTimeout(() => setPaused(true), 220); };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasHold = paused && holdTimer.current === null;
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (paused) { setPaused(false); if (wasHold) return; return; }
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) prev(); else next();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95" role="dialog" aria-label="Story">
      <button onClick={onClose} className="absolute top-4 right-4 z-20 hidden size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:grid" aria-label="Close stories">
        <X className="size-6" />
      </button>
      {gi > 0 && (
        <button onClick={() => { setGi(gi - 1); setSi(0); setProgress(0); }} className="absolute left-4 z-20 hidden size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid" aria-label="Previous person">
          <ChevronLeft className="size-6" />
        </button>
      )}
      {gi < groups.length - 1 && (
        <button onClick={() => { setGi(gi + 1); setSi(0); setProgress(0); }} className="absolute right-4 z-20 hidden size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid" aria-label="Next person">
          <ChevronRight className="size-6" />
        </button>
      )}

      <div className="relative flex h-full max-h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*9/16))] flex-col overflow-hidden bg-black sm:h-[94dvh] sm:rounded-2xl">
        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white transition-[width] duration-75 ease-linear" style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-3 z-10 flex items-center gap-2.5 bg-gradient-to-b from-black/50 to-transparent px-3 pt-3 pb-6 text-white">
          <Link href={`/profile/${group.author.username}`} onClick={onClose} className="flex min-w-0 items-center gap-2.5">
            <UserAvatar src={group.author.avatarUrl} name={group.author.displayName} className="size-9 ring-2 ring-white/40" />
            <span className="truncate text-sm font-semibold">{group.isMe ? "Your story" : group.author.displayName}</span>
            {group.author.isVerified && <VerifiedMark />}
          </Link>
          <span className="text-xs text-white/70">{formatDistanceToNowStrict(new Date(story.createdAt))}</span>
          {story.audience === "public" ? <Globe className="size-3.5 text-white/70" /> : <Users className="size-3.5 text-white/70" />}
          <div className="ml-auto flex items-center gap-1">
            {story.kind === "video" && (
              <button onClick={() => setMuted((m) => !m)} className="rounded-full p-1.5 hover:bg-white/10" aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            )}
            <button onClick={() => setPaused((p) => !p)} className="rounded-full p-1.5 hover:bg-white/10" aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            {group.isMe && (
              <DropdownMenu onOpenChange={(o) => setPaused(o)}>
                <DropdownMenuTrigger className="rounded-full p-1.5 hover:bg-white/10" aria-label="Story options"><MoreHorizontal className="size-5" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[160]">
                  <DropdownMenuItem variant="destructive" onClick={() => remove.mutate()}><Trash2 /> Delete story</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10 sm:hidden" aria-label="Close stories">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => holdTimer.current && clearTimeout(holdTimer.current)}>
          <AnimatePresence mode="wait">
            <motion.div key={story.id} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0.4 }} transition={{ duration: 0.15 }} className="absolute inset-0 grid place-items-center">
              {story.kind === "image" && story.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.mediaUrl} alt="" className="max-h-full w-full object-contain" draggable={false} />
              )}
              {story.kind === "video" && story.mediaUrl && (
                <video
                  ref={video}
                  src={story.mediaUrl}
                  autoPlay
                  playsInline
                  muted={muted}
                  className="max-h-full w-full object-contain"
                  onTimeUpdate={(e) => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
                  onEnded={next}
                />
              )}
              {story.kind === "text" && (
                <div className="grid size-full place-items-center p-8" style={{ background: story.background ?? undefined }}>
                  <p className="text-center text-2xl leading-snug font-bold break-words whitespace-pre-wrap text-white drop-shadow sm:text-3xl">{story.text}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent p-3">
          {group.isMe ? (
            <button onClick={() => setViewersOpen(true)} className="flex items-center gap-2.5 rounded-full px-1 py-1 text-sm font-semibold text-white">
              {viewers.data && viewers.data.length > 0 && (
                <span className="flex -space-x-2">
                  {viewers.data.slice(0, 3).map((v) => (
                    <UserAvatar key={v.id} src={v.avatarUrl} name={v.displayName} className="size-7 ring-2 ring-black" />
                  ))}
                </span>
              )}
              <span className="flex items-center gap-1.5"><Eye className="size-4" /> {story.viewCount ?? 0} viewer{story.viewCount === 1 ? "" : "s"}</span>
              <ChevronDown className="size-4 rotate-180 opacity-70" />
            </button>
          ) : (
            <div className="space-y-2.5">
              {/* Reactions */}
              <div className="relative flex justify-center gap-1.5 sm:gap-2.5">
                {STORY_REACTIONS.map((e) => (
                  <motion.button
                    key={e}
                    whileHover={{ scale: 1.2, y: -3 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={(ev) => sendReaction(e, ev.currentTarget)}
                    className="grid size-12 place-items-center rounded-full"
                    aria-label={`React ${e}`}
                  >
                    <AnimatedEmoji emoji={e} size={34} />
                  </motion.button>
                ))}
                {/* The tapped emoji floats up a little and fades away */}
                <AnimatePresence>
                  {bursts.map((b) => (
                    <motion.span
                      key={b.key}
                      initial={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: "-50%", y: -110, opacity: 0, scale: 1.7 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      onAnimationComplete={() => setBursts((cur) => cur.filter((x) => x.key !== b.key))}
                      className="pointer-events-none absolute top-1.5 leading-none"
                      style={{ left: b.x }}
                    >
                      <AnimatedEmoji emoji={b.emoji} size={34} />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              {/* Message */}
              <form
                onSubmit={(e) => { e.preventDefault(); if (reply.trim() && !sendReply.isPending) sendReply.mutate({ id: story.id, content: reply.trim() }); }}
                className="flex items-center gap-2"
              >
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  placeholder={`Send message to ${group.author.displayName.split(" ")[0]}…`}
                  maxLength={1000}
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/30 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/60"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sendReply.isPending}
                  className={cn("grid size-11 shrink-0 place-items-center rounded-full text-white transition-colors", reply.trim() ? "bg-primary" : "bg-white/10 opacity-60")}
                  aria-label="Send message"
                >
                  <SendHorizontal className="size-5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Viewers panel — slides up inside the story card, like Facebook */}
        <AnimatePresence>
          {viewersOpen && (
            <>
              <motion.button
                key="scrim"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setViewersOpen(false)}
                className="absolute inset-0 z-20 bg-black/40"
                aria-label="Close viewers"
              />
              <motion.div
                key="panel"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, i) => { if (i.offset.y > 80 || i.velocity.y > 500) setViewersOpen(false); }}
                className="absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-2xl bg-[#242526] text-white shadow-2xl"
                role="dialog"
                aria-label="Story viewers"
              >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" />
                <div className="flex items-center justify-between border-b border-white/10 px-4 pt-2 pb-3">
                  <div>
                    <p className="text-[17px] font-bold">Story details</p>
                    <p className="flex items-center gap-1.5 text-sm text-white/60"><Eye className="size-4" /> {story.viewCount ?? 0} viewer{story.viewCount === 1 ? "" : "s"}</p>
                  </div>
                  <button onClick={() => setViewersOpen(false)} className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close viewers">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                  {viewers.isLoading && <p className="px-2 py-6 text-center text-sm text-white/60">Loading…</p>}
                  {viewers.data?.length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <Eye className="mx-auto mb-2 size-8 text-white/40" />
                      <p className="font-semibold">No viewers yet</p>
                      <p className="text-sm text-white/60">When people view your story, you&apos;ll see them here.</p>
                    </div>
                  )}
                  {viewers.data?.map((v) => (
                    <Link key={v.id} href={`/profile/${v.username}`} onClick={onClose} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10">
                      <span className="relative shrink-0">
                        <UserAvatar src={v.avatarUrl} name={v.displayName} className="size-11" />
                        {v.reaction && <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-[#242526]"><AnimatedEmoji emoji={v.reaction} size={18} /></span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{v.displayName}</p>
                        <p className="text-xs text-white/60">{formatDistanceToNowStrict(new Date(v.viewedAt))} ago</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
}
