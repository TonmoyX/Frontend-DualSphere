"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { get } from "@/lib/api";
import type { Post } from "@/lib/types";
import { CommentsPanel } from "./comment-thread";
import { PostCard } from "./post-card";

export function postTitle(p: Post) {
  return p.visibility === "anonymous" || !p.author ? "Anonymous post" : `${p.author.displayName.split(" ")[0]}'s post`;
}

/** Facebook-style post modal: title bar, the post, scrollable comments, composer pinned at the bottom. */
export function PostModal({ post, open, onOpenChange }: { post: Post; open: boolean; onOpenChange: (o: boolean) => void }) {
  // Keep it live (likes/comments counters) while open
  const { data } = useQuery({
    queryKey: ["post", post.id],
    queryFn: async () => (await get<{ post: Post }>(`/posts/${post.id}`)).post,
    initialData: post,
    enabled: open,
  });
  const p = data ?? post;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-[700px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]">
        <div className="relative shrink-0 border-b px-12 py-3.5">
          <DialogTitle className="truncate text-center font-sans text-lg font-bold tracking-normal">{postTitle(p)}</DialogTitle>
          <DialogDescription className="sr-only">Post and comments</DialogDescription>
        </div>
        <CommentsPanel
          postId={p.id}
          anonAuthor={p.visibility === "anonymous" && p.isOwner}
          className="flex-1"
          header={
            <div className="border-b pb-1">
              <PostCard post={p} variant="embedded" />
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
