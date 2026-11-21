"use client";

import { useQuery } from "@tanstack/react-query";
import { Images, Lock, Play, VenetianMask } from "lucide-react";
import Link from "next/link";
import {
  AnonAvatar,
  TimeAgo,
  UserAvatar,
  VerifiedMark,
} from "@/components/common/bits";
import { get } from "@/lib/api";
import type { Post, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export type InternalLink = { raw: string; path: string } & (
  { type: "post"; id: string } | { type: "profile"; username: string }
);

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const URL_RE = /https?:\/\/[^\s<]+/g;

/** A link to a post or profile on this site (same origin or the configured site URL). */
export function parseInternalLink(raw: string): InternalLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const origins = [
    SITE,
    typeof window !== "undefined" ? window.location.origin : "",
  ].filter(Boolean);
  if (!origins.includes(u.origin)) return null;
  const post = /^\/post\/([0-9a-f-]{36})\/?$/i.exec(u.pathname);
  if (post) return { raw, path: u.pathname, type: "post", id: post[1] };
  const profile = /^\/profile\/([A-Za-z0-9_.]{2,40})\/?$/.exec(u.pathname);
  if (profile)
    return { raw, path: u.pathname, type: "profile", username: profile[1] };
  return null;
}

export function firstInternalLink(text: string): InternalLink | null {
  for (const m of text.match(URL_RE) ?? []) {
    const l = parseInternalLink(m);
    if (l) return l;
  }
  return null;
}

// Card width: alone it IS the bubble; inside a text bubble it must fit within the bubble's padding
const cardW = (flush?: boolean) =>
  flush ? "w-[min(300px,68vw)]" : "w-[min(284px,calc(78vw-5rem))]";

const host = () =>
  typeof window !== "undefined"
    ? window.location.host
    : SITE.replace(/^https?:\/\//, "");

/** Rich preview for a shared post / profile link, Messenger-style. */
export function LinkPreview({
  link,
  mine,
  flush,
}: {
  link: InternalLink;
  mine?: boolean;
  flush?: boolean;
}) {
  return link.type === "post" ? (
    <PostLinkCard id={link.id} path={link.path} mine={mine} flush={flush} />
  ) : (
    <ProfileLinkCard
      username={link.username}
      path={link.path}
      mine={mine}
      flush={flush}
    />
  );
}

function Shell({
  href,
  mine,
  flush,
  children,
}: {
  href: string;
  mine?: boolean;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "group/lp block overflow-hidden text-left text-card-foreground transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110",
        cardW(flush),
        flush
          ? "rounded-2xl border bg-card shadow-sm"
          : cn(
              "mt-1.5 rounded-xl",
              mine ? "bg-white/95 dark:bg-card" : "bg-muted/70",
            ),
      )}
    >
      {children}
    </Link>
  );
}

function Footer({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center gap-1.5 border-t px-3 py-2 text-[11px] text-muted-foreground">
      <span className="size-3.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400" />
      <span className="font-semibold">{label}</span>
      <span className="min-w-0 truncate">
        · {host()}
        {path}
      </span>
    </div>
  );
}

function Skeleton({ thumb, flush }: { thumb?: boolean; flush?: boolean }) {
  return (
    <div className={cn(cardW(flush), !flush && "mt-1.5")}>
      <div className="w-full animate-pulse overflow-hidden rounded-xl bg-muted/70">
        {thumb && (
          <div className="aspect-[1.91/1] bg-black/10 dark:bg-white/10" />
        )}
        <div className="space-y-2 p-3">
          <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function Unavailable({
  what,
  mine,
  flush,
}: {
  what: string;
  mine?: boolean;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center",
        cardW(flush),
        " gap-3 p-3 text-card-foreground",
        flush
          ? "rounded-2xl border bg-card"
          : cn(
              "mt-1.5 rounded-xl",
              mine ? "bg-white/95 dark:bg-card" : "bg-muted/70",
            ),
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] dark:bg-white/10">
        <Lock className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          This {what} isn&apos;t available
        </p>
        <p className="text-xs text-muted-foreground">
          It may have been deleted or made private.
        </p>
      </div>
    </div>
  );
}

function PostLinkCard({
  id,
  path,
  mine,
  flush,
}: {
  id: string;
  path: string;
  mine?: boolean;
  flush?: boolean;
}) {
  const q = useQuery({
    queryKey: ["link-preview", "post", id],
    queryFn: async () => (await get<{ post: Post }>(`/posts/${id}`)).post,
    staleTime: 60_000,
    retry: false,
  });
  if (q.isLoading) return <Skeleton thumb flush={flush} />;
  if (!q.data || q.data.isRemoved)
    return <Unavailable what="post" mine={mine} flush={flush} />;

  const post = q.data;
  // For a share, preview the original's media (the share itself has none)
  const src = post.isShare && post.sharedPost ? post.sharedPost : post;
  const anon = post.visibility === "anonymous" || !post.author;
  const media = src.media.filter(
    (m) => m.type === "image" || m.type === "video",
  );
  const first = media[0];
  const text = post.content || src.content;

  return (
    <Shell href={path} mine={mine} flush={flush}>
      {src.postType === "avatar_update" && first ? (
        <div className="grid aspect-[1.91/1] place-items-center bg-gradient-to-br from-identity/25 via-identity/10 to-transparent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={first.url}
            alt=""
            className="size-24 rounded-full border-4 border-card object-cover shadow-lg"
          />
        </div>
      ) : first ? (
        <div className="relative aspect-[1.91/1] overflow-hidden bg-black">
          {first.type === "video" ? (
            <>
              {/* #t seeks to a frame so the first image shows as a thumbnail */}
              <video
                src={`${first.url}#t=0.5`}
                preload="metadata"
                muted
                playsInline
                className="size-full object-cover"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/20">
                <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white ring-2 ring-white/80 backdrop-blur-sm transition-transform group-hover/lp:scale-110">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={first.url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover/lp:scale-[1.03]"
            />
          )}
          {media.length > 1 && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Images className="size-3" /> {media.length}
            </span>
          )}
        </div>
      ) : (
        // Text-only post: big quote on a soft gradient, like Facebook text posts
        <div
          className={cn(
            "grid aspect-[1.91/1] place-items-center px-5",
            anon
              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
              : "bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500",
          )}
        >
          <p className="line-clamp-4 text-center text-[17px] leading-snug font-bold break-words text-white drop-shadow-sm">
            {text || "Shared a post"}
          </p>
        </div>
      )}

      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          {anon ? (
            <AnonAvatar className="size-6" />
          ) : (
            <UserAvatar
              src={post.author!.avatarUrl}
              name={post.author!.displayName}
              className="size-6"
            />
          )}
          <span
            className={cn(
              "min-w-0 truncate text-[13px] font-semibold",
              anon && "text-anon",
            )}
          >
            {anon ? (
              <span className="inline-flex items-center gap-1">
                <VenetianMask className="size-3.5" /> Anonymous
              </span>
            ) : (
              post.author!.displayName
            )}
          </span>
          {!anon && post.author!.isVerified && <VerifiedMark />}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            <TimeAgo date={post.createdAt} />
          </span>
        </div>
        {first && text && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug break-words text-foreground/90">
            {text}
          </p>
        )}
        {!first && post.isShare && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Shared a post
          </p>
        )}
      </div>
      <Footer label="Post" path={path} />
    </Shell>
  );
}

function ProfileLinkCard({
  username,
  path,
  mine,
  flush,
}: {
  username: string;
  path: string;
  mine?: boolean;
  flush?: boolean;
}) {
  const q = useQuery({
    queryKey: ["link-preview", "profile", username.toLowerCase()],
    queryFn: async () =>
      (await get<{ user: Profile }>(`/users/${encodeURIComponent(username)}`))
        .user,
    staleTime: 60_000,
    retry: false,
  });
  if (q.isLoading) return <Skeleton flush={flush} />;
  if (!q.data) return <Unavailable what="profile" mine={mine} flush={flush} />;
  const u = q.data;

  return (
    <Shell href={path} mine={mine} flush={flush}>
      {/* Cover */}
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-violet-500/40 via-fuchsia-400/30 to-cyan-400/30">
        {u.coverUrl && !u.restricted && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="relative px-3 pb-3">
        <UserAvatar
          src={u.avatarUrl}
          name={u.displayName}
          className="-mt-10 size-20 border-4 border-card text-xl shadow-md"
        />
        <div className="mt-1.5 flex items-center gap-1">
          <span className="truncate text-[15px] font-bold">
            {u.displayName}
          </span>
          {u.isVerified && <VerifiedMark />}
        </div>
        <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
        {u.restricted ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Locked profile
          </p>
        ) : (
          u.bio && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-foreground/90">
              {u.bio}
            </p>
          )
        )}
        {u.friends.mutualCount > 0 && !u.isMe && (
          <p className="mt-1 text-xs text-muted-foreground">
            {u.friends.mutualCount} mutual friend
            {u.friends.mutualCount === 1 ? "" : "s"}
          </p>
        )}
        <span className="mt-2.5 flex h-8 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary transition-colors group-hover/lp:bg-primary/15">
          View profile
        </span>
      </div>
      <Footer label="Profile" path={path} />
    </Shell>
  );
}
