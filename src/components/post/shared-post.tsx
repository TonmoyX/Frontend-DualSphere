"use client";

import { Lock, VenetianMask } from "lucide-react";
import Link from "next/link";
import { AnonAvatar, TimeAgo, UserAvatar, VerifiedMark } from "@/components/common/bits";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MediaGrid } from "./media-grid";

/** The original post shown inside a share (Facebook-style bordered card). */
export function SharedPostPreview({ post, link = false }: { post: Post; link?: boolean }) {
  const anon = post.visibility === "anonymous" || !post.author;
  const media = (
    <>
      {post.postType === "avatar_update" && post.media[0] ? (
        <div className="flex justify-center bg-gradient-to-b from-identity/10 to-transparent py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.media[0].url} alt="" className="size-44 rounded-full border-4 border-card object-cover shadow-lg" />
        </div>
      ) : (
        post.media.length > 0 && <div className="[&>*]:mt-0 [&>*]:rounded-none [&>*]:border-0">{/* edge-to-edge */}<MediaGrid media={post.media} /></div>
      )}
    </>
  );
  const text = (
    <>
      <div className="flex items-start gap-2.5 p-3">
        {anon ? <AnonAvatar className="size-9" /> : <UserAvatar src={post.author!.avatarUrl} name={post.author!.displayName} className="size-9" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            {anon ? (
              <span className="inline-flex items-center gap-1 font-semibold text-anon"><VenetianMask className="size-3.5" /> Anonymous</span>
            ) : (
              <>
                <span className="font-semibold">{post.author!.displayName}</span>
                {post.author!.isVerified && <VerifiedMark />}
              </>
            )}
            <span className="text-muted-foreground">·</span>
            <TimeAgo date={post.createdAt} />
          </div>
          {post.postType === "avatar_update" && <p className="text-sm text-muted-foreground">updated their profile picture</p>}
          {post.postType === "cover_update" && <p className="text-sm text-muted-foreground">updated their cover photo</p>}
          {post.content && <p className="mt-1 line-clamp-6 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.content}</p>}
        </div>
      </div>
    </>
  );
  // Media stays interactive (lightbox/video), so only the text part is the link to the original
  return (
    <div className="mt-2 overflow-hidden rounded-xl border bg-background/40">
      {media}
      {link ? <Link href={`/post/${post.id}`} className={cn("block transition-colors hover:bg-accent/40")}>{text}</Link> : text}
    </div>
  );
}

/** Shown when the original of a share was deleted or is no longer available. */
export function SharedPostUnavailable() {
  return (
    <div className="mt-2 flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] dark:bg-white/10"><Lock className="size-4" /></span>
      <div>
        <p className="text-[15px] font-semibold">This content isn&apos;t available right now</p>
        <p className="text-sm text-muted-foreground">The owner may have deleted it, or it was removed.</p>
      </div>
    </div>
  );
}
