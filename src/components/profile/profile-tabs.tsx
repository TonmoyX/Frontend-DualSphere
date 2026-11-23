"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Lock, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, Spinner, UserAvatar } from "@/components/common/bits";
import { FriendCardItem } from "@/components/friends/friend-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { get } from "@/lib/api";
import type { FriendCard, Photo, Profile } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

/** "Rafi, Nadia and 3 other mutual friends" with an avatar stack, under the bio. */
export function MutualFriendsLine({ p, onOpen }: { p: Profile; onOpen: () => void }) {
  const { mutualCount: n, mutualPreview: pv } = p.friends;
  if (!n) return null;
  const names = pv.slice(0, 2).map((x) => x.displayName.split(" ")[0]);
  const text = n === 1 ? names[0] : `including ${names.join(" and ")}`;
  return (
    <button type="button" onClick={onOpen} className="mt-3 flex items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground">
      <span className="flex -space-x-2">
        {pv.slice(0, 5).map((m) => <UserAvatar key={m.id} src={m.avatarUrl} name={m.displayName} className="size-7 text-[9px] ring-2 ring-card" />)}
      </span>
      <span><b className="font-semibold text-foreground">{n} mutual friend{n > 1 ? "s" : ""}</b> · {text}</span>
    </button>
  );
}

export function FriendsTab({ p }: { p: Profile }) {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["friends", "of", p.username.toLowerCase(), me?.id ?? "anon"],
    queryFn: () => get<{ mode: "all" | "mutual" | "hidden" | "locked"; friends: FriendCard[] }>(`/users/${p.username}/friends`),
  });
  const list = (data?.friends ?? []).filter((f) => !q || `${f.displayName} ${f.username}`.toLowerCase().includes(q.toLowerCase()));
  const first = p.displayName.split(" ")[0];

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-bold tracking-normal">{data?.mode === "mutual" ? "Mutual friends" : "Friends"}</h2>
          {data?.mode === "mutual" && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="size-3.5" /> {first} only shares their friends list with some people. You can see friends you have in common.</p>
          )}
          {data?.mode === "all" && <p className="text-sm text-muted-foreground">{data.friends.length} friend{data.friends.length === 1 ? "" : "s"}</p>}
        </div>
        {!!data?.friends.length && (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}
      </div>
      {isLoading && <Spinner className="size-5" />}
      {data?.mode === "locked" && <EmptyState icon={<Users className="size-8" />} title="No friends to show" />}
      {data?.mode === "hidden" && (
        <EmptyState icon={<Lock className="size-8" />} title="Friends list is private"><Link href="/login" className="text-primary hover:underline">Log in</Link> to see mutual friends.</EmptyState>
      )}
      {data && data.mode !== "hidden" && data.mode !== "locked" && list.length === 0 && (
        <EmptyState icon={<Users className="size-8" />} title={q ? "No one matches" : data.mode === "mutual" ? "No mutual friends" : "No friends to show"} />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((f) => (
          <FriendCardItem key={f.id} u={f} status={f.viewerStatus ?? (me?.id === f.id ? "self" : "none")} />
        ))}
      </div>
    </div>
  );
}

export function PhotosTab({ p }: { p: Profile }) {
  const { user: me } = useAuth();
  const [open, setOpen] = useState<number | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["photos", p.username.toLowerCase(), me?.id ?? "anon"],
    queryFn: ({ pageParam }) => get<{ photos: Photo[]; hasMore: boolean; locked: boolean }>(`/users/${p.username}/photos?page=${pageParam}&limit=30`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
  });
  const photos = q.data?.pages.flatMap((pg) => pg.photos) ?? [];
  const current = open !== null ? photos[open] : null;

  // Arrow-key navigation in the viewer
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === "ArrowLeft") setOpen((i) => (i !== null && i > 0 ? i - 1 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="mb-4 font-sans text-lg font-bold tracking-normal">Photos</h2>
      {q.isLoading && <Spinner className="size-5" />}
      {!q.isLoading && photos.length === 0 && (
        <EmptyState icon={<ImageIcon className="size-8" />} title="No photos yet">
          {p.isMe ? "Photos you share in identity posts will appear here." : `Photos ${p.displayName.split(" ")[0]} shares will appear here.`}
        </EmptyState>
      )}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((ph, i) => (
          <button key={`${ph.postId}-${ph.url}`} onClick={() => setOpen(i)} className="group relative aspect-square overflow-hidden rounded-md bg-muted sm:rounded-lg" aria-label="Open photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-accent">
            {q.isFetchingNextPage ? "Loading…" : "See more photos"}
          </button>
        </div>
      )}

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent showCloseButton={false} className="max-w-5xl border-0 bg-black/95 p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {current && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt="" className="max-h-[80vh] w-full object-contain" />
              <button onClick={() => setOpen(null)} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X className="size-5" /></button>
              {open! > 0 && (
                <button onClick={() => setOpen(open! - 1)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Previous"><ChevronLeft /></button>
              )}
              {open! < photos.length - 1 && (
                <button onClick={() => setOpen(open! + 1)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Next"><ChevronRight /></button>
              )}
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/80">
                <span>{current.isProfilePicture ? "Profile picture · " : current.isCoverPhoto ? "Cover photo · " : ""}{new Date(current.createdAt).toLocaleDateString()}</span>
                <Link href={`/post/${current.postId}`} className="flex items-center gap-1 font-medium text-white hover:underline">View post <ExternalLink className="size-3.5" /></Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
