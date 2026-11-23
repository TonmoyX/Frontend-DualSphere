"use client";

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Check, Clock, EyeOff, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Pin, PinOff, Lock, Repeat2, ShieldX, Sparkles, TimerOff, Trash2, VenetianMask } from "lucide-react";
import { GroupsIcon } from "@/components/common/groups-icon";
import { LockedPostPanel } from "@/components/money/pay";
import { CommunityRemoveDialog, useCommunityPage } from "@/components/community/community-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AnonAvatar, compact, RoleBadge, TimeAgo, UserAvatar, VerifiedMark } from "@/components/common/bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { del, errorMessage, patch, post as apiPost } from "@/lib/api";
import type { FeedPage, Post, SharePolicy } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { FOCUS_COMPOSER_EVENT } from "./comment-thread";
import { MediaGrid } from "./media-grid";
import { PostModal } from "./post-modal";
import { ReportDialog } from "./report-dialog";
import { ShareButton } from "./share-menu";
import { SharedPostPreview, SharedPostUnavailable } from "./shared-post";
import { policiesFor, policyMeta } from "./share-policy";

/**
 * variant:
 *  feed     → comment button opens the Facebook-style post modal
 *  detail   → shown on /post/[id]; comment button focuses the comment box
 *  embedded → inside the post modal (flat, no card chrome)
 */
export function PostCard({ post, linkToDetail, variant }: { post: Post; linkToDetail?: boolean; variant?: "feed" | "detail" | "embedded" }) {
  const v = variant ?? (linkToDetail === false ? "detail" : "feed");
  const [modalOpen, setModalOpen] = useState(false);
  const openComments = () => (v === "feed" ? setModalOpen(true) : window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT)));
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modRemoveOpen, setModRemoveOpen] = useState(false);
  const anon = post.visibility === "anonymous";
  // On a community page, its mods get pin/remove (the API re-checks the role)
  const page = useCommunityPage();
  const onOwnCommunityPage = !!post.community && page?.slug === post.community.slug;
  const canCommunityModerate = onOwnCommunityPage && !!page?.canModerate && !post.isRemoved;

  const patchEverywhere = (fn: (p: Post) => Post) => {
    for (const key of ["feed", "profile-posts", "saved"]) {
      qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: [key] }, (d) =>
        d ? { ...d, pages: d.pages.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === post.id ? fn(p) : p)) })) } : d,
      );
    }
    qc.setQueryData<Post>(["post", post.id], (p) => (p ? fn(p) : p));
  };

  const save = useMutation({
    mutationFn: (on: boolean) => (on ? apiPost(`/posts/${post.id}/save`) : del(`/posts/${post.id}/save`)),
    onMutate: (on) => patchEverywhere((p) => ({ ...p, savedByMe: on })),
    onSuccess: (_r, on) => {
      qc.invalidateQueries({ queryKey: ["saved"] });
      toast.success(on ? "Saved — find it under Saved in your menu" : "Removed from saved");
    },
    onError: (e, on) => { patchEverywhere((p) => ({ ...p, savedByMe: !on })); toast.error(errorMessage(e)); },
  });

  const setPolicy = useMutation({
    mutationFn: (v: SharePolicy) => patch(`/posts/${post.id}`, { sharePolicy: v }),
    onMutate: (v) => {
      const prev = post.sharePolicy;
      patchEverywhere((p) => ({ ...p, sharePolicy: v }));
      return prev;
    },
    onSuccess: (_r, v) => toast.success(`Who can share: ${policyMeta(v).label}`),
    onError: (e, _v, prev) => { patchEverywhere((p) => ({ ...p, sharePolicy: prev })); toast.error(errorMessage(e)); },
  });

  const like = useMutation({
    mutationFn: () => apiPost<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`),
    onMutate: () =>
      patchEverywhere((p) => ({ ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) })),
    onSuccess: (r) => patchEverywhere((p) => ({ ...p, likedByMe: r.liked, likesCount: r.likesCount })),
    onError: (e) => {
      patchEverywhere((p) => ({ ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) }));
      toast.error(errorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: () => del(`/posts/${post.id}`),
    onSuccess: () => {
      qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["feed"] }, (d) =>
        d ? { ...d, pages: d.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.id !== post.id) })) } : d,
      );
      qc.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success("Post deleted");
      if (v !== "feed") router.push("/");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const requireUser = (fn: () => void) => () => (user ? fn() : router.push("/login"));

  // Feed controls (like Facebook): hide this post, or snooze its author for 30 days. Both can be undone.
  const dropFromFeeds = (match: (p: Post) => boolean) => qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["feed"] }, (d) =>
    d ? { ...d, pages: d.pages.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => !match(p)) })) } : d,
  );
  const hidePost = () => {
    dropFromFeeds((p) => p.id === post.id);
    apiPost(`/feed/hide/${post.id}`)
      .then(() => toast("Post hidden", { description: "You'll see fewer posts like this.", action: { label: "Undo", onClick: () => void del(`/feed/hide/${post.id}`).then(() => qc.invalidateQueries({ queryKey: ["feed"] })) } }))
      .catch((e) => { toast.error(errorMessage(e)); qc.invalidateQueries({ queryKey: ["feed"] }); });
  };
  const snoozeAuthor = () => {
    const a = post.author;
    if (!a) return;
    dropFromFeeds((p) => p.author?.id === a.id);
    apiPost(`/feed/snooze/${a.id}`)
      .then(() => toast(`Snoozed ${a.displayName} for 30 days`, { action: { label: "Undo", onClick: () => void del(`/feed/snooze/${a.id}`).then(() => qc.invalidateQueries({ queryKey: ["feed"] })) } }))
      .catch((e) => { toast.error(errorMessage(e)); qc.invalidateQueries({ queryKey: ["feed"] }); });
  };

  const pin = useMutation({
    mutationFn: (on: boolean) => apiPost(`/communities/${post.community!.slug}/posts/${post.id}/pin`, { pinned: on }),
    onSuccess: (_r, on) => {
      toast.success(on ? "Pinned to the top of the community" : "Unpinned");
      qc.invalidateQueries({ queryKey: ["community-posts", post.community!.slug] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group relative transition-colors",
        v === "embedded" ? "px-4 pt-4 pb-2" : "rounded-2xl border bg-card p-4",
        v !== "embedded" && (anon ? "hover:border-anon/25" : "hover:border-identity/25"),
      )}
    >
      <header className="flex items-start gap-3">
        {anon || !post.author ? (
          <AnonAvatar />
        ) : (
          <Link href={`/profile/${post.author.username}`}>
            <UserAvatar src={post.author.avatarUrl} name={post.author.displayName} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {anon || !post.author ? (
              <>
                <span className="font-semibold text-anon">Anonymous</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-anon/20 bg-anon/10 px-1.5 py-0.5 text-[11px] font-semibold text-anon">
                  <VenetianMask className="size-3" /> Anon
                </span>
                {post.isShare && <span className="text-sm text-muted-foreground">shared a post</span>}
              </>
            ) : (
              <>
                <Link href={`/profile/${post.author.username}`} className="truncate font-semibold hover:underline">
                  {post.author.displayName}
                </Link>
                {post.author.isVerified && <VerifiedMark />}
                <RoleBadge role={post.author.role} />
                {post.postType === "avatar_update" ? (
                  <span className="text-sm text-muted-foreground">updated their profile picture</span>
                ) : post.postType === "cover_update" ? (
                  <span className="text-sm text-muted-foreground">updated their cover photo</span>
                ) : post.isShare ? (
                  <span className="text-sm text-muted-foreground">shared a post</span>
                ) : (
                  <span className="truncate text-sm text-muted-foreground">@{post.author.username}</span>
                )}
              </>
            )}
            <span className="text-muted-foreground">·</span>
            <Link href={`/post/${post.id}`} className="hover:underline">
              <TimeAgo date={post.createdAt} />
            </Link>
            {post.isOwner && anon && <span className="text-[11px] text-muted-foreground">(only you can see this is yours)</span>}
          </div>
          {(post.community && !onOwnCommunityPage) || post.isPinned || post.isPending || (post.access && post.access !== "public") ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {post.community && !onOwnCommunityPage && (
                <Link href={`/c/${post.community.slug}`} className="inline-flex items-center gap-1 font-medium hover:text-foreground hover:underline">
                  <GroupsIcon className="size-3.5" /> {post.community.name}
                </Link>
              )}
              {post.isPinned && <span className="inline-flex items-center gap-1 font-medium text-primary"><Pin className="size-3.5" /> Pinned</span>}
              {post.access === "paid" && <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400"><Lock className="size-3" /> Paid{post.priceMinor ? ` · ${formatMoney(post.priceMinor, post.currency)}` : ""}</span>}
              {post.access === "subscribers" && <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary"><Sparkles className="size-3" /> Members only</span>}
              {post.isPending && <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400"><Clock className="size-3.5" /> Waiting for approval</span>}
            </div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100" aria-label="Post options">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                toast.success("Link copied");
              }}
            >
              <Link2 /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={requireUser(() => save.mutate(!post.savedByMe))}>
              {post.savedByMe ? <><BookmarkCheck className="text-primary" /> Unsave post</> : <><Bookmark /> Save post</>}
            </DropdownMenuItem>
            {post.isOwner && !post.isShare && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Repeat2 className="size-4 text-muted-foreground" />
                  <span className="flex-1 whitespace-nowrap">Who can share</span>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">{policyMeta(post.sharePolicy).label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {policiesFor(post.visibility).map((o) => (
                    <DropdownMenuItem key={o.v} onClick={() => o.v !== (post.sharePolicy ?? "everyone") && setPolicy.mutate(o.v)} className="items-start gap-2.5 py-2">
                      <o.Icon className="mt-0.5" />
                      <span className="flex-1">
                        <span className="block font-medium">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">{o.hint}</span>
                      </span>
                      {(post.sharePolicy ?? "everyone") === o.v && <Check className="mt-0.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {user && !post.isOwner && v === "feed" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={hidePost} className="items-start gap-2.5 py-2">
                  <EyeOff className="mt-0.5" />
                  <span><span className="block font-medium">Hide post</span><span className="block text-xs text-muted-foreground">See fewer posts like this</span></span>
                </DropdownMenuItem>
                {!anon && post.author && post.author.id !== user.id && (
                  <DropdownMenuItem onClick={snoozeAuthor} className="items-start gap-2.5 py-2">
                    <TimerOff className="mt-0.5" />
                    <span><span className="block font-medium">Snooze {post.author.displayName} for 30 days</span><span className="block text-xs text-muted-foreground">Temporarily stop seeing their posts</span></span>
                  </DropdownMenuItem>
                )}
              </>
            )}
            {!post.isOwner && (
              <DropdownMenuItem onClick={requireUser(() => setReportOpen(true))}>
                <Flag /> Report
              </DropdownMenuItem>
            )}
            {canCommunityModerate && !post.isPending && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => pin.mutate(!post.isPinned)}>
                  {post.isPinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to top</>}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setModRemoveOpen(true)}>
                  <ShieldX /> Remove from community
                </DropdownMenuItem>
              </>
            )}
            {post.isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Caption starts under the avatar and runs the full width (Facebook-style) */}
      <div className="mt-3">
        {post.isRemoved && <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">Removed by moderators</p>}
        {post.content &&
          (v === "feed" ? (
            <button type="button" onClick={() => setModalOpen(true)} className="block w-full text-left">
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.content}</p>
            </button>
          ) : (
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.content}</p>
          ))}
        {post.postType === "avatar_update" && post.media[0] ? (
          <Link href={`/post/${post.id}`} className="-mx-4 mt-3 flex justify-center bg-gradient-to-b from-identity/15 via-identity/5 to-transparent py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.media[0].url} alt={`${post.author?.displayName ?? "User"}'s new profile picture`} className="size-56 rounded-full border-4 border-card object-cover shadow-xl sm:size-64" />
          </Link>
        ) : (
          // Edge to edge: no side padding, like Facebook
          post.media.length > 0 && <div className="-mx-4 mt-3"><MediaGrid media={post.media} bleed /></div>
        )}
        {post.locked && post.access && post.access !== "public" && post.author && (
          <LockedPostPanel
            postId={post.id}
            access={post.access}
            priceMinor={post.priceMinor ?? null}
            currency={post.currency ?? null}
            mediaCount={post.lockedMediaCount ?? 0}
            authorUsername={post.author.username}
            authorName={post.author.displayName}
          />
        )}
        {post.isShare && (post.sharedPost ? <SharedPostPreview post={post.sharedPost} link /> : <SharedPostUnavailable />)}

        <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={requireUser(() => like.mutate())}
            className={cn("group/like flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors hover:bg-pink-500/10 hover:text-pink-400", post.likedByMe && "text-pink-400")}
            aria-pressed={post.likedByMe}
            aria-label="Like"
          >
            <motion.span key={String(post.likedByMe)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
              <Heart className={cn("size-4", post.likedByMe && "fill-current")} />
            </motion.span>
            <AnimatePresence mode="popLayout" initial={false}>
              {post.likesCount > 0 && (
                <motion.span key={post.likesCount} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="tabular-nums">
                  {compact(post.likesCount)}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            type="button"
            onClick={openComments}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors hover:bg-identity/10 hover:text-identity"
            aria-label="Comments"
          >
            <MessageCircle className="size-4" />
            {post.commentsCount > 0 && <span className="tabular-nums">{compact(post.commentsCount)}</span>}
          </button>
          <ShareButton post={post} />
        </div>
      </div>

      {v === "feed" && modalOpen && <PostModal post={post} open={modalOpen} onOpenChange={setModalOpen} />}
      {canCommunityModerate && <CommunityRemoveDialog slug={post.community!.slug} postId={post.id} open={modRemoveOpen} onOpenChange={setModRemoveOpen} />}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ type: "post", id: post.id }} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>It will disappear from all feeds. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.article>
  );
}
