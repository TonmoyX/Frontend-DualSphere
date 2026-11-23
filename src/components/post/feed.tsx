"use client";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Inbox } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { SponsoredCard } from "@/components/ads/sponsored-card";
import { EmptyState, Spinner } from "@/components/common/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post as apiPost } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { getSocket } from "@/lib/socket";
import type { FeedMode, FeedPage, Post } from "@/lib/types";
import { PostCard } from "./post-card";

export function PostSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Reports which posts the viewer actually saw (≥50% visible for ~1s) so the ranked feed can push them down next
 * time — that's what keeps the top of the feed fresh. Batched every few seconds.
 */
function useSeenTracker(enabled: boolean) {
  const queue = useRef(new Set<string>());
  const sent = useRef(new Set<string>());
  const timers = useRef(new Map<Element, ReturnType<typeof setTimeout>>());
  const io = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      const ids = [...queue.current].slice(0, 50);
      if (!ids.length) return;
      ids.forEach((id) => queue.current.delete(id));
      void apiPost("/feed/seen", { postIds: ids }).catch(() => {});
    };
    const t = setInterval(flush, 4000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    const timersMap = timers.current;
    io.current = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.postId;
        if (!id || sent.current.has(id)) continue;
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!timersMap.has(e.target)) {
            timersMap.set(e.target, setTimeout(() => { sent.current.add(id); queue.current.add(id); timersMap.delete(e.target); }, 1000));
          }
        } else {
          const tm = timersMap.get(e.target);
          if (tm) { clearTimeout(tm); timersMap.delete(e.target); }
        }
      }
    }, { threshold: [0, 0.5] });
    return () => {
      flush();
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      io.current?.disconnect();
      io.current = null;
      timersMap.forEach(clearTimeout);
      timersMap.clear();
    };
  }, [enabled]);

  // Posts rendered before the observer existed
  useEffect(() => {
    if (enabled) document.querySelectorAll<HTMLElement>("[data-post-id]").forEach((el) => io.current?.observe(el));
  });

  // Ref callback for each post wrapper
  return (el: HTMLElement | null) => { if (el && io.current) io.current.observe(el); };
}

/** Cursor-paginated infinite list. `queryKey` scopes the cache; `path` must accept ?cursor. */
export function PostList({ queryKey, path, live = false, mode = "all", empty, accept, sponsored = false, trackSeen = false, adPlacement = "feed" }: {
  queryKey: unknown[];
  path: string;
  live?: boolean;
  mode?: FeedMode;
  empty?: React.ReactNode;
  /** Extra filter for live posts (e.g. only this community's posts on a community page). */
  accept?: (p: Post) => boolean;
  /** Show one Sponsored post after every 8 posts (main feed only). */
  sponsored?: boolean;
  /** Tell the ranked feed which posts were seen (main feed, Reels). */
  trackSeen?: boolean;
  adPlacement?: "feed" | "reels";
}) {
  const { user } = useAuth();
  const observe = useSeenTracker(trackSeen && !!user);
  const qc = useQueryClient();
  const sentinel = useRef<HTMLDivElement>(null);
  const [incoming, setIncoming] = useState<Post[]>([]);

  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => get<FeedPage>(`${path}${path.includes("?") ? "&" : "?"}limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.cursor : null),
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Live: queue new posts behind a "N new posts" pill (no layout jumps while reading)
  const keyStr = JSON.stringify(queryKey);
  useEffect(() => {
    if (!live) return;
    const key = JSON.parse(keyStr);
    const s = getSocket();
    const onNew = (p: Post) => {
      if (accept) {
        if (!accept(p)) return;
      } else if (mode === "communities") {
        return; // the Communities feed refreshes on load; live posts arrive per community page
      } else {
        // The socket is shared: posts pushed to a community room must never land in the main feed
        if (p.community) return;
        if (mode !== "all" && p.visibility !== mode) return;
      }
      const cached = qc.getQueryData<InfiniteData<FeedPage>>(key);
      if (cached?.pages.some((pg) => pg.posts.some((x) => x.id === p.id))) return; // our own post, already inserted
      setIncoming((cur) => (cur.some((x) => x.id === p.id) ? cur : [p, ...cur]));
    };
    s.on("post:new", onNew);
    return () => void s.off("post:new", onNew);
  }, [live, mode, qc, keyStr, accept]);

  // Hide queued "new post" entries already in the list (e.g. your own post/share,
  // whose socket echo can arrive before the request finishes)
  const loadedIds = new Set(q.data?.pages.flatMap((pg) => pg.posts.map((p) => p.id)) ?? []);
  const pending = incoming.filter((p) => !loadedIds.has(p.id));

  const showIncoming = () => {
    qc.setQueryData<InfiniteData<FeedPage>>(queryKey, (d) => {
      if (!d) return d;
      const existing = new Set(d.pages.flatMap((pg) => pg.posts.map((p) => p.id)));
      const fresh = incoming.filter((p) => !existing.has(p.id));
      return { ...d, pages: [{ ...d.pages[0], posts: [...fresh, ...d.pages[0].posts] }, ...d.pages.slice(1)] };
    });
    setIncoming([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Community feeds send their pinned posts with the first page
  const pinned = q.data?.pages[0]?.pinned ?? [];
  // A ranked feed can be re-ranked between page loads; never show the same post twice
  const seenIds = new Set<string>();
  const posts = (q.data?.pages.flatMap((p) => p.posts) ?? []).filter((p) => (seenIds.has(p.id) ? false : (seenIds.add(p.id), true)));

  return (
    <div className="relative space-y-3">
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.button
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={showIncoming}
            className="sticky top-20 z-30 mx-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30"
          >
            <ArrowUp className="size-4" /> {pending.length} new post{pending.length > 1 ? "s" : ""}
          </motion.button>
        )}
      </AnimatePresence>

      {q.isLoading && Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />)}
      {q.isError && <EmptyState title="Couldn't load posts">Check that the API server is running, then refresh.</EmptyState>}
      {!q.isLoading && !q.isError && posts.length === 0 && pinned.length === 0 && (empty ?? <EmptyState icon={<Inbox className="size-8" />} title="Nothing here yet">Be the first to post something.</EmptyState>)}

      <AnimatePresence initial={false}>
        {pinned.map((p) => (
          <PostCard key={`pin-${p.id}`} post={p} />
        ))}
        {posts.map((p, i) => (
          <Fragment key={p.id}>
            <div data-post-id={p.id} ref={observe}>
              <PostCard post={p} />
            </div>
            {sponsored && i % 8 === 3 && <SponsoredCard slot={Math.floor(i / 8)} placement={adPlacement} />}
          </Fragment>
        ))}
      </AnimatePresence>

      <div ref={sentinel} />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      )}
      {!hasNextPage && posts.length > 5 && <p className="py-6 text-center text-xs text-muted-foreground">You&apos;re all caught up ✨</p>}
    </div>
  );
}
