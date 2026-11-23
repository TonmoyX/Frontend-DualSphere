"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, Briefcase, Camera, Heart, Sparkles, GraduationCap, MapPin, Clapperboard, Flag, VenetianMask, Link2, Lock, LockOpen, MoreHorizontal, Plus, Send, Settings, ShieldCheck, Trash2, Upload, Users, ImageIcon } from "lucide-react";
import { ReportDialog } from "@/components/post/report-dialog";
import { CreateStoryDialog } from "@/components/stories/create-story-dialog";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { compact, EmptyState, RoleBadge, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { PostList } from "@/components/post/feed";
import { AvatarUploadDialog, CoverUploadDialog } from "@/components/profile/avatar-upload-dialog";
import { FriendButton } from "@/components/friends/friend-button";
import { FriendsTab, MutualFriendsLine, PhotosTab } from "@/components/profile/profile-tabs";
import { ReelsTab } from "@/components/profile/reels-tab";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { FollowButton, FollowListDialog } from "@/components/profile/follow";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { del, errorMessage, get, post, put } from "@/lib/api";
import type { Conversation, CreatorPublic, Profile, SelfUser } from "@/lib/types";
import { SubscribeDialog, TipDialog } from "@/components/money/pay";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

function LockedCard({ name }: { name: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-5">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Lock className="size-5" /></div>
      <div>
        <p className="font-semibold">{name.split(" ")[0]} locked their profile</p>
        <p className="text-sm text-muted-foreground">Only their friends can see their posts and photos.</p>
      </div>
    </div>
  );
}

/** Empty tab for locked profiles (Facebook shows nothing, not even mutual friends). */
function EmptyTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <EmptyState icon={icon} title={title} />
    </div>
  );
}

type Tab = "posts" | "friends" | "photos" | "reels" | "anonymous";

export default function ProfilePage() {
  return <Suspense><ProfileInner /></Suspense>;
}

function ProfileInner() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { features } = useSettings();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<"avatar" | "cover" | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [followList, setFollowList] = useState<"followers" | "following" | null>(null);
  const search = useSearchParams();
  const [tipOpen, setTipOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(search.get("join") === "1");
  const tab: Tab = (["posts", "friends", "photos", "reels", "anonymous"] as const).includes(search.get("tab") as Tab) ? (search.get("tab") as Tab) : "posts";
  const setTab = (t: Tab) => router.replace(t === "posts" ? `/profile/${username}` : `/profile/${username}?tab=${t}`, { scroll: false });

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["profile", username.toLowerCase(), me?.id ?? "anon"],
    queryFn: async () => (await get<{ user: Profile }>(`/users/${username}`)).user,
  });
  // Creator memberships / tips (public info + your own membership)
  const { data: creator } = useQuery({
    queryKey: ["creator-public", username.toLowerCase(), me?.id ?? "anon"],
    queryFn: () => get<CreatorPublic>(`/creators/${username}`),
    enabled: !!user && !user.restricted,
  });

  // Belt and braces: never treat your own profile as someone else's
  const isMe = !!user && (user.isMe || me?.id === user.id);
  const locked = !!user?.profileLocked;
  const restricted = !!user?.restricted && !isMe;

  const removePhoto = useMutation({
    mutationFn: (kind: "avatar" | "cover") =>
      put<{ user: SelfUser }>("/users/me", kind === "avatar" ? { avatarMediaId: null } : { coverMediaId: null }),
    onSuccess: ({ user: u }, kind) => {
      qc.setQueryData(["me"], u);
      refreshProfile();
      toast.success(kind === "avatar" ? "Profile picture removed" : "Cover photo removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setConfirmRemove(null),
  });

  const refreshProfile = () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-posts"] });
  };

  const message = useMutation({
    mutationFn: () => post<{ conversation: Conversation }>("/conversations", { userIds: [user!.id] }),
    onSuccess: ({ conversation }) => router.push(`/messages/${conversation.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggleBlock = useMutation({
    mutationFn: () => (user!.blockedByMe ? del(`/blocks/${user!.id}`) : post(`/blocks/${user!.id}`)),
    onSuccess: () => {
      toast.success(user!.blockedByMe ? `Unblocked @${user!.username}` : `Blocked @${user!.username}`);
      refreshProfile();
      qc.invalidateQueries({ queryKey: ["dm"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggleLock = useMutation({
    mutationFn: (v: boolean) => put<{ user: SelfUser }>("/users/me", { profileLocked: v }),
    onSuccess: ({ user: u }) => {
      qc.setQueryData(["me"], u);
      refreshProfile();
      toast.success(u.profileLocked ? "Your profile is locked" : "Your profile is unlocked");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });


  // Every profile has its own link; shared in chat it shows the profile photo, name and link
  const profileUrl = () => `${window.location.origin}/profile/${user?.username ?? username}`;
  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileUrl());
    toast.success("Profile link copied");
  };

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="User not found">This account doesn&apos;t exist or has been suspended.</EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border bg-card">
        {/* Cover */}
        <div className="relative">
          <button
            type="button"
            disabled={!user?.coverUrl || restricted}
            onClick={() => user?.coverUrl && setViewer(user.coverUrl)}
            className="block h-48 w-full bg-gradient-to-br from-identity/40 via-primary/20 to-anon/20 bg-cover bg-center sm:h-72 lg:h-[380px]"
            style={user?.coverUrl && !restricted ? { backgroundImage: `url(${user.coverUrl})` } : undefined}
            aria-label="View cover photo"
          />
          {isMe && (
            <>
              {user?.coverUrl ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="absolute right-4 bottom-4 shadow-lg" disabled={removePhoto.isPending}>
                      <Camera /> <span className="hidden sm:inline">Edit cover photo</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="whitespace-nowrap">
                    <DropdownMenuItem onSelect={() => setCoverOpen(true)}><Upload /> Upload new photo</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove("cover")}><Trash2 /> Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" variant="secondary" className="absolute right-4 bottom-4 shadow-lg" onClick={() => setCoverOpen(true)}>
                  <Camera /> <span className="hidden sm:inline">Add cover photo</span>
                </Button>
              )}
            </>
          )}
        </div>

        <div className="px-4 pb-4 sm:px-8">
          <div className="-mt-16 flex flex-col gap-3 sm:-mt-20 sm:flex-row sm:items-end sm:gap-5 lg:-mt-24">
            {/* Avatar */}
            <div className="relative shrink-0 self-start sm:self-auto">
              {user ? (
                <button
                  type="button"
                  onClick={() => user.avatarUrl && setViewer(user.avatarUrl)}
                  className="rounded-full"
                  aria-label="View profile picture"
                >
                  <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-32 border-[5px] border-card text-4xl shadow-xl sm:size-40 lg:size-44" />
                </button>
              ) : (
                <Skeleton className="size-32 rounded-full border-[5px] border-card sm:size-40 lg:size-44" />
              )}
              {locked && (
                <span className="absolute right-1 bottom-2 grid size-9 sm:right-2 sm:bottom-3 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground" title="Locked profile">
                  <Lock className="size-4" />
                </span>
              )}
              {isMe && !locked && (user?.avatarUrl ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="absolute right-1 bottom-2 grid size-10 sm:right-2 sm:bottom-3 place-items-center rounded-full border-2 border-card bg-secondary shadow hover:bg-accent"
                    aria-label="Profile picture options"
                    disabled={removePhoto.isPending}
                  >
                    <Camera className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="whitespace-nowrap">
                    <DropdownMenuItem onSelect={() => setAvatarOpen(true)}><Upload /> Upload new photo</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove("avatar")}><Trash2 /> Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  onClick={() => setAvatarOpen(true)}
                  className="absolute right-1 bottom-2 grid size-10 sm:right-2 sm:bottom-3 place-items-center rounded-full border-2 border-card bg-secondary shadow hover:bg-accent"
                  aria-label="Add profile picture"
                >
                  <Camera className="size-4" />
                </button>
              ))}
            </div>

            {/* Name, handle and stats */}
            <div className="min-w-0 flex-1 sm:pt-[92px] sm:pb-2 lg:pt-[108px]">
              {isLoading || !user ? (
                <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold break-all sm:text-4xl">{user.displayName}</h1>
                    {user.isVerified && <VerifiedMark />}
                    <RoleBadge role={user.role} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
                    @{user.username}
                  </p>
                  {!restricted && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">

                      {user.follow?.followers != null && (
                        <button type="button" onClick={() => setFollowList("followers")} className="hover:underline">
                          <b className="font-semibold text-foreground tabular-nums">{compact(user.follow.followers)}</b> follower{user.follow.followers === 1 ? "" : "s"}
                        </button>
                      )}
                      {user.follow?.following != null && (
                        <button type="button" onClick={() => setFollowList("following")} className="hover:underline">
                          <b className="font-semibold text-foreground tabular-nums">{compact(user.follow.following)}</b> following
                          {isMe && me?.followingVisibility && me.followingVisibility !== "public" && (
                            me.followingVisibility === "friends"
                              ? <Users className="ml-1 inline size-3 -translate-y-px" aria-label="Only your friends can see this" />
                              : <Lock className="ml-1 inline size-3 -translate-y-px" aria-label="Only you can see this" />
                          )}
                        </button>
                      )}

                    </div>
                  )}

                  {isMe && locked && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                      <ShieldCheck className="size-4 shrink-0" /> You locked your profile. Only your friends can see your posts, bio and photos here.
                    </p>
                  )}

                  {restricted ? null : (
                    <div className="lg:hidden">
                  {user.bio && <p className="mt-3 max-w-2xl text-[15px] whitespace-pre-wrap">{user.bio}</p>}
                  {(user.work || user.education || user.location) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {user.work && <span className="flex items-center gap-1.5"><Briefcase className="size-4" /> {user.work}</span>}
                      {user.education && <span className="flex items-center gap-1.5"><GraduationCap className="size-4" /> {user.education}</span>}
                      {user.location && <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {user.location}</span>}
                    </div>
                  )}
                </div>
                  )}
                </>
              )}
              {user && !isMe && !restricted && <MutualFriendsLine p={user} onOpen={() => setTab("friends")} />}
            </div>

            {/* Actions */}
            {user && (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pb-2">
                {isMe ? (
                  <>
                    <Button onClick={() => setStoryOpen(true)}><Plus strokeWidth={2.75} /> Add to story</Button>
                    <Button variant="secondary" asChild><Link href="/settings"><Settings /> Edit profile</Link></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-lg border p-2 hover:bg-accent" aria-label="Profile options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem asChild><Link href="/settings"><Settings /> Edit profile</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={copyProfileLink}><Link2 /> Copy profile link</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmLock(true)}>
                          {locked ? <LockOpen /> : <Lock />} {locked ? "Unlock profile" : "Lock profile"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : me ? (
                  <>
                    {!user.blockedByMe && <FriendButton userId={user.id} name={user.displayName} status={user.friends.status} />}
                    {!user.blockedByMe && user.follow && (
                      <FollowButton username={user.username} name={user.displayName} isFollowing={user.follow.isFollowing} isFriend={user.friends.status === "friends"} />
                    )}
                    {!user.blockedByMe && creator?.isCreator && creator.tiers.length > 0 && (
                      <Button size="sm" onClick={() => setJoinOpen(true)}><Sparkles /> {creator.membership ? "Member" : "Join"}</Button>
                    )}
                    {!user.blockedByMe && creator?.isCreator && creator.tipsEnabled && (
                      <Button size="sm" variant="secondary" onClick={() => setTipOpen(true)}><Heart className="text-pink-500" /> Tip</Button>
                    )}
                    {features.messagingEnabled && !user.blockedByMe && (
                      <Button size="sm" variant={user.friends.status === "none" || user.friends.status === "outgoing" ? "secondary" : "default"} onClick={() => message.mutate()} disabled={message.isPending}>
                        <Send /> <span className="hidden sm:inline">Message</span>
                      </Button>
                    )}
                    {user.blockedByMe && <Button size="sm" variant="outline" onClick={() => toggleBlock.mutate()}>Unblock</Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-lg border p-2 hover:bg-accent" aria-label="More options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={copyProfileLink}><Link2 /> Copy profile link</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setReportOpen(true)}><Flag /> Report profile</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => toggleBlock.mutate()}>
                          <Ban /> {user.blockedByMe ? "Unblock" : "Block"} @{user.username}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        {user && (
          <div className="flex overflow-x-auto border-t px-1 [scrollbar-width:none] sm:px-6">
            {(["posts", "friends", "photos", "reels", ...(isMe ? (["anonymous"] as const) : [])] as const).map((t) => (
              <button
                key={t}
                ref={tab === t ? (el) => el?.scrollIntoView({ inline: "nearest", block: "nearest" }) : undefined}
                onClick={() => setTab(t)}
                className={cn("relative shrink-0 px-3 py-3 text-[15px] font-semibold whitespace-nowrap capitalize transition-colors sm:px-4", tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {t === "friends" && !isMe && !restricted && user.friends.mutualCount && !user.friends.canSeeList ? "Mutual friends" : t}
                {tab === t && <motion.span layoutId="profile-tab" className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <div className="mt-4">
        {user && tab === "friends" && (restricted ? <EmptyTab icon={<Users className="size-8" />} title="No friends to show" /> : <FriendsTab p={user} />)}
        {/* Your own anonymous posts — this tab exists only on your own profile */}
        {user && tab === "anonymous" && isMe && (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-anon/25 bg-anon/10 px-4 py-3 text-sm">
              <VenetianMask className="mt-0.5 size-4 shrink-0 text-anon" />
              <p>
                <b className="font-semibold">Only you can see this.</b>{" "}
                <span className="text-muted-foreground">Everyone else sees these posts as Anonymous, and they never show on your profile for anyone else.</span>
              </p>
            </div>
            <PostList
              queryKey={["my-anonymous"]}
              path="/feed/my-anonymous"
              empty={<EmptyState icon={<VenetianMask className="size-8" />} title="No anonymous posts yet">Posts you share anonymously will be listed here, just for you.</EmptyState>}
            />
          </div>
        )}
        {user && tab === "reels" && (restricted ? <EmptyTab icon={<Clapperboard className="size-8" />} title="No reels to show" /> : <ReelsTab p={user} />)}
        {user && tab === "photos" && (restricted ? <EmptyTab icon={<ImageIcon className="size-8" />} title="No photos to show" /> : <PhotosTab p={user} />)}
        {user && tab === "posts" && (restricted ? <div className="mx-auto max-w-2xl"><LockedCard name={user.displayName} /></div> : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
            <aside className="hidden lg:sticky lg:top-20 lg:block">
              <ProfileSidebar p={user} isMe={isMe} onTab={setTab} />
            </aside>
            <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 text-anon" />
              Profiles only show identity posts. Anonymous posts are never linked here.
            </div>
            <PostList
              queryKey={["profile-posts", user.username]}
              path={`/users/${user.username}/posts`}
              empty={<EmptyState title="No posts yet">{isMe ? "Your identity posts will appear here." : `@${user.username} hasn't posted yet.`}</EmptyState>}
            />
            </div>
          </div>
        ))}
      </div>

      {user && creator?.isCreator && !isMe && (
        <>
          <TipDialog open={tipOpen} onOpenChange={setTipOpen} creatorId={user.id} creatorName={user.displayName} />
          {creator.tiers.length > 0 && <SubscribeDialog open={joinOpen} onOpenChange={setJoinOpen} creatorName={user.displayName} info={creator} />}
        </>
      )}
      {user && <FollowListDialog username={user.username} kind={followList} onClose={() => setFollowList(null)} />}
      {user?.isMe && <CreateStoryDialog open={storyOpen} onOpenChange={setStoryOpen} />}
      {user && !user.isMe && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ type: "user", id: user.username }} />}

      {/* Own profile: lock / unlock confirmation */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && !removePhoto.isPending && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmRemove === "avatar" ? "Remove profile picture?" : "Remove cover photo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove === "avatar"
                ? "Your profile will show your initials instead. Posts you already shared to the feed stay as they are."
                : "Your profile will show the default background instead. Posts you already shared to the feed stay as they are."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePhoto.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={removePhoto.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmRemove) removePhoto.mutate(confirmRemove); }}
            >
              {removePhoto.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">{locked ? <LockOpen className="size-5" /> : <Lock className="size-5" />} {locked ? "Unlock your profile?" : "Lock your profile?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {locked ? (
                <div>Everyone will be able to see your bio, cover photo, stats and the posts on your profile again.</div>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-left">
                  <li>Only your friends can see your full profile. Everyone else sees just your name, username and profile picture.</li>
                  <li>Your bio, cover photo, friends list, stats and profile posts become friends-only.</li>
                  <li>People can still message you (unless you block them).</li>
                  <li>Posts you share to the feed are still shown in the feed.</li>
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleLock.mutate(!locked)}>{locked ? "Unlock profile" : "Lock your profile"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AvatarUploadDialog open={avatarOpen} onOpenChange={setAvatarOpen} />
      <CoverUploadDialog open={coverOpen} onOpenChange={setCoverOpen} />

      {/* Photo viewer */}
      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {viewer && <img src={viewer} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
