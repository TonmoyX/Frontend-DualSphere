"use client";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState, Spinner } from "@/components/common/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/api";
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

/** Cursor-paginated infinite list. `queryKey` scopes the cache; `path` must accept ?cursor. */
export function PostList({ queryKey, path, live = false, mode = "all", empty }: {
  queryKey: unknown[];
  path: string;
  live?: boolean;
  mode?: FeedMode;
  empty?: React.ReactNode;
}) {
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
      if (mode !== "all" && p.visibility !== mode) return;
      const cached = qc.getQueryData<InfiniteData<FeedPage>>(key);
      if (cached?.pages.some((pg) => pg.posts.some((x) => x.id === p.id))) return; // our own post, already inserted
      setIncoming((cur) => (cur.some((x) => x.id === p.id) ? cur : [p, ...cur]));
    };
    s.on("post:new", onNew);
    return () => void s.off("post:new", onNew);
  }, [live, mode, qc, keyStr]);

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

  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];

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
      {!q.isLoading && !q.isError && posts.length === 0 && (empty ?? <EmptyState icon={<Inbox className="size-8" />} title="Nothing here yet">Be the first to post something.</EmptyState>)}

      <AnimatePresence initial={false}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
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
