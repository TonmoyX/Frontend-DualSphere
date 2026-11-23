"use client";

import { Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/common/bits";
import { PostList } from "@/components/post/feed";

/** Reels: video posts from the main feed (community posts stay inside their communities). */
export default function ReelsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Clapperboard className="size-6 text-primary" /> Reels</h1>
      <p className="mb-5 text-sm text-muted-foreground">Videos picked for you.</p>
      <PostList
        queryKey={["feed", "reels"]}
        path="/feed?media=video"
        live
        trackSeen
        sponsored
        adPlacement="reels"
        accept={(p) => !p.community && p.media.some((m) => m.type === "video")}
        empty={<EmptyState icon={<Clapperboard className="size-8" />} title="No reels yet">Share a video from the feed and it shows up here.</EmptyState>}
      />
    </div>
  );
}
