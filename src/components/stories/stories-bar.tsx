"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/common/bits";
import { get } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { StoryGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { CreateStoryDialog } from "./create-story-dialog";
import { StoryViewer } from "./story-viewer";

/** Facebook-style stories row at the top of the feed. */
export function StoriesBar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const { data: groups = [] } = useQuery({
    queryKey: ["stories", "feed"],
    queryFn: async () => (await get<{ groups: StoryGroup[] }>("/stories/feed")).groups,
    enabled: !!user,
    refetchInterval: 120_000,
  });

  // New stories from friends appear live
  useEffect(() => {
    const s = getSocket();
    const onUpdate = () => qc.invalidateQueries({ queryKey: ["stories"] });
    s.on("story:update", onUpdate);
    return () => void s.off("story:update", onUpdate);
  }, [qc]);

  if (!user) return null;
  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={scroller} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-2.5">
        {/* Create story */}
        {/* Create story — Facebook-style: photo on top, a separate panel below, "+" sitting on the seam */}
        <button
          onClick={() => setCreating(true)}
          className="group relative flex h-48 w-28 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md sm:w-[7.5rem] dark:bg-[#242526] dark:ring-white/5"
        >
          <div className="relative h-[70%] overflow-hidden bg-zinc-200 dark:bg-black">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-identity/30 to-anon/20 text-3xl font-bold text-identity">{user.displayName[0]}</div>
            )}
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          </div>
          <div className="relative flex flex-1 items-end justify-center pb-2.5">
            {/* the ring uses the panel colour so the button looks cut into the seam */}
            <span className="absolute top-0 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#0866ff] text-white shadow-sm transition-transform group-hover:scale-105 dark:border-[#242526]">
              <Plus className="size-5" strokeWidth={2.75} />
            </span>
            <span className="text-[13px] font-semibold text-foreground">Create story</span>
          </div>
        </button>

        {/* One card per person (your own first if you have stories) */}
        {groups.map((g, i) => {
          const latest = g.stories.at(-1)!;
          return (
            <button key={g.author.id} onClick={() => setViewing(i)} className="group relative h-48 w-28 shrink-0 overflow-hidden rounded-xl bg-black text-left shadow-sm sm:w-[7.5rem]">
              {latest.kind === "image" && latest.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={latest.mediaUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              )}
              {latest.kind === "video" && latest.mediaUrl && <video src={latest.mediaUrl} muted preload="metadata" className="size-full object-cover" />}
              {latest.kind === "text" && (
                <div className="grid size-full place-items-center p-2" style={{ background: latest.background ?? undefined }}>
                  <p className="line-clamp-4 text-center text-xs font-bold text-white">{latest.text}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
              <span className={cn("absolute top-2 left-2 rounded-full p-[3px]", g.hasUnseen ? "bg-gradient-to-tr from-primary via-fuchsia-500 to-anon" : "bg-white/40")}>
                <UserAvatar src={g.author.avatarUrl} name={g.author.displayName} className="size-9 border-2 border-black text-[10px]" />
              </span>
              <span className="absolute inset-x-2 bottom-2 truncate text-xs font-semibold text-white drop-shadow">{g.isMe ? "Your story" : g.author.displayName}</span>
            </button>
          );
        })}
      </div>

      {groups.length > 3 && (
        <>
          <button onClick={() => scroll(-1)} className="absolute top-1/2 -left-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full border bg-card shadow-md hover:bg-accent sm:grid" aria-label="Scroll stories left"><ChevronLeft className="size-5" /></button>
          <button onClick={() => scroll(1)} className="absolute top-1/2 -right-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full border bg-card shadow-md hover:bg-accent sm:grid" aria-label="Scroll stories right"><ChevronRight className="size-5" /></button>
        </>
      )}

      <CreateStoryDialog open={creating} onOpenChange={setCreating} />
      <AnimatePresence>
        {viewing !== null && groups[viewing] && <StoryViewer key={viewing} groups={groups} start={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </div>
  );
}
