"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/bits";
import { CommentsPanel } from "@/components/post/comment-thread";
import { PostSkeleton } from "@/components/post/feed";
import { PostCard } from "@/components/post/post-card";
import { postTitle } from "@/components/post/post-modal";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/api";
import type { Post } from "@/lib/types";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => (await get<{ post: Post }>(`/posts/${id}`)).post,
  });

  return (
    <div className="mx-auto max-w-[700px] px-2 py-3 sm:px-4 sm:py-5">
      {isLoading && <PostSkeleton />}
      {isError && (
        <EmptyState title="Post not found">
          It may have been deleted or removed. <Link href="/" className="text-primary hover:underline">Back to the feed</Link>
        </EmptyState>
      )}
      {data && (
        <div className="flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border bg-card sm:h-[calc(100dvh-7rem)]">
          <div className="relative flex shrink-0 items-center border-b px-2 py-2.5">
            <Button variant="ghost" size="icon" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} aria-label="Back">
              <ArrowLeft />
            </Button>
            <h1 className="absolute inset-x-14 truncate text-center font-sans text-lg font-bold tracking-normal">{postTitle(data)}</h1>
          </div>
          <CommentsPanel
            postId={data.id}
            anonAuthor={data.visibility === "anonymous" && data.isOwner}
            className="flex-1"
            header={<div className="border-b pb-1"><PostCard post={data} variant="embedded" /></div>}
          />
        </div>
      )}
    </div>
  );
}
