"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import type { FeedPage, Post } from "@/lib/types";
import { useDmRealtime } from "@/components/messages/dm";
import { useAuth } from "./auth-provider";

/** Applies live counter updates / removals to every cached feed and post. */
export function RealtimeBridge() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useDmRealtime(user?.id);

  useEffect(() => {
    const s = getSocket();

    const patchPost = (id: string, fn: (p: Post) => Post | null) => {
      qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["feed"] }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((pg) => ({
                ...pg,
                posts: pg.posts.flatMap((p) => (p.id === id ? (fn(p) ? [fn(p)!] : []) : [p])),
              })),
            }
          : data,
      );
      qc.setQueryData<Post>(["post", id], (p) => (p ? (fn(p) ?? { ...p, isRemoved: true }) : p));
    };

    // Partial updates: likes/comments/views counts, shares count, share policy, or edited text/media
    const onUpdate = ({ id, ...u }: { id: string } & Partial<Pick<Post, "likesCount" | "commentsCount" | "sharesCount" | "sharePolicy" | "content" | "editedAt" | "media" | "viewsCount">>) =>
      patchPost(id, (p) => ({ ...p, ...Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined)) }));
    const onRemoved = (u: { id: string }) => patchPost(u.id, () => null);
    const onNotification = () => qc.invalidateQueries({ queryKey: ["notifications"] });
    const onFriend = () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    };

    s.on("post:update", onUpdate);
    s.on("post:removed", onRemoved);
    s.on("notification", onNotification);
    s.on("friend:update", onFriend);
    return () => {
      s.off("post:update", onUpdate);
      s.off("post:removed", onRemoved);
      s.off("notification", onNotification);
      s.off("friend:update", onFriend);
    };
  }, [qc]);

  return null;
}
