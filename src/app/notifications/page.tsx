"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Gavel, Heart, MessageCircle, MessageSquareReply, Send, ShieldAlert, UserCheck, UserPlus, VenetianMask } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AnonAvatar, EmptyState, Spinner, TimeAgo, UserAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { get, post } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const ICON = {
  like: { Icon: Heart, cls: "text-pink-400 bg-pink-400/10", text: "liked your post" },
  comment: { Icon: MessageCircle, cls: "text-identity bg-identity/10", text: "commented on your post" },
  reply: { Icon: MessageSquareReply, cls: "text-cyan-400 bg-cyan-400/10", text: "replied to your comment" },
  security: { Icon: ShieldAlert, cls: "text-warning bg-warning/10", text: "" },
  moderation: { Icon: Gavel, cls: "text-destructive bg-destructive/10", text: "" },
  system: { Icon: Bell, cls: "text-muted-foreground bg-muted", text: "" },
  friend_request: { Icon: UserPlus, cls: "text-primary bg-primary/10", text: "sent you a friend request" },
  share: { Icon: Send, cls: "text-emerald-500 bg-emerald-500/10", text: "shared your post" },
  friend_accept: { Icon: UserCheck, cls: "text-anon bg-anon/10", text: "accepted your friend request" },
};

/** Activity on YOUR anonymous posts reads as "…your anonymous post" (visible only to you). */
const ANON_TEXT: Partial<Record<string, string>> = {
  like: "liked your anonymous post",
  comment: "commented on your anonymous post",
  reply: "replied to your anonymous comment",
  share: "shared your anonymous post",
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/notifications");
  }, [loading, user, router]);

  const q = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) => get<{ items: Notification[]; cursor: string | null; hasMore: boolean }>(`/notifications?limit=30${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (l) => (l.hasMore ? l.cursor : null),
    enabled: !!user,
  });

  type Page = { items: Notification[]; cursor: string | null; hasMore: boolean };
  // Optimistically flip read state in the list + the navbar badge
  const setRead = (ids: string[] | "all") => {
    let flipped = 0;
    qc.setQueryData<InfiniteData<Page>>(["notifications", "list"], (d) =>
      d ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((n) => {
        if (n.read || (ids !== "all" && !ids.includes(n.id))) return n;
        flipped++;
        return { ...n, read: true };
      }) })) } : d,
    );
    qc.setQueryData<{ count: number }>(["notifications", "unread"], (c) => (c ? { count: ids === "all" ? 0 : Math.max(0, c.count - flipped) } : c));
  };
  const markAll = useMutation({
    mutationFn: () => post("/notifications/read"),
    onMutate: () => setRead("all"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications", "unread"] }),
  });
  const markOne = (n: Notification) => {
    if (n.read) return;
    setRead([n.id]);
    post("/notifications/read", { ids: [n.id] }).catch(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  };

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={!items.some((i) => !i.read)}>
          <CheckCheck /> Mark all read
        </Button>
      </div>
      {q.isLoading && <Spinner className="mx-auto block size-6 text-muted-foreground" />}
      {!q.isLoading && items.length === 0 && (
        <EmptyState icon={<Bell className="size-8" />} title="You're all caught up">Likes, comments and replies on your identity posts show up here.</EmptyState>
      )}
      <div className="space-y-2">
        {items.map((n, i) => {
          const meta = ICON[n.type] ?? ICON.system;
          const body = (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={cn("flex gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/40", !n.read && "border-primary/25 bg-primary/5")}
            >
              <div className={cn("grid size-9 shrink-0 place-items-center rounded-full", meta.cls)}><meta.Icon className="size-4" /></div>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  {n.actorAnon ? (
                    <span className="inline-flex items-center gap-1.5 align-middle font-semibold text-anon">
                      <AnonAvatar className="size-5" />
                      Anonymous
                    </span>
                  ) : n.actor && (
                    <span className="inline-flex items-center gap-1.5 align-middle font-semibold">
                      <UserAvatar src={n.actor.avatarUrl} name={n.actor.displayName} className="size-5 text-[9px]" />
                      {n.actor.displayName}
                    </span>
                  )}{" "}
                  {n.message ?? (n.onAnonymousPost ? ANON_TEXT[n.type] ?? meta.text : meta.text)}
                </p>
                {n.onAnonymousPost && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-anon/10 px-1.5 py-0.5 text-[11px] font-medium text-anon">
                    <VenetianMask className="size-3" /> Only you can see this
                  </span>
                )}
                {n.postExcerpt && <p className="mt-1 truncate text-muted-foreground">“{n.postExcerpt}”</p>}
                <TimeAgo date={n.createdAt} />
              </div>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
            </motion.div>
          );
          const href = n.postId ? `/post/${n.postId}` : n.type === "friend_request" ? "/friends?tab=requests" : n.type === "friend_accept" && n.actor ? `/profile/${n.actor.username}` : null;
          return href ? (
            <Link key={n.id} href={href} onClick={() => markOne(n)}>{body}</Link>
          ) : (
            <button key={n.id} type="button" onClick={() => markOne(n)} className="block w-full text-left">{body}</button>
          );
        })}
      </div>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</Button>
        </div>
      )}
    </div>
  );
}
