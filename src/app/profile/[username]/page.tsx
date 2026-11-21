"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, Camera, Clapperboard, Flag, VenetianMask, Link2, Lock, LockOpen, MoreHorizontal, Plus, Send, Settings, ShieldCheck, Users, ImageIcon } from "lucide-react";
import { ReportDialog } from "@/components/post/report-dialog";
import { CreateStoryDialog } from "@/components/stories/create-story-dialog";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { compact, EmptyState, RoleBadge, Spinner, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { PostList } from "@/components/post/feed";
import { AvatarUploadDialog } from "@/components/profile/avatar-upload-dialog";
import { FriendButton } from "@/components/friends/friend-button";
import { FriendsTab, MutualFriendsLine, PhotosTab } from "@/components/profile/profile-tabs";
import { ReelsTab } from "@/components/profile/reels-tab";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { del, errorMessage, get, post, put } from "@/lib/api";
import type { Conversation, Profile, SelfUser } from "@/lib/types";
import { uploadMedia } from "@/lib/upload";
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
  const coverInput = useRef<HTMLInputElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const search = useSearchParams();
  const tab: Tab = (["posts", "friends", "photos", "reels", "anonymous"] as const).includes(search.get("tab") as Tab) ? (search.get("tab") as Tab) : "posts";
  const setTab = (t: Tab) => router.replace(t === "posts" ? `/profile/${username}` : `/profile/${username}?tab=${t}`, { scroll: false });

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["profile", username.toLowerCase(), me?.id ?? "anon"],
    queryFn: async () => (await get<{ user: Profile }>(`/users/${username}`)).user,
  });
  // Belt and braces: never treat your own profile as someone else's
  const isMe = !!user && (user.isMe || me?.id === user.id);
  const locked = !!user?.profileLocked;
  const restricted = !!user?.restricted && !isMe;

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

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setCoverBusy(true);
    try {
      const m = await uploadMedia(file, "cover");
      const { user: u } = await put<{ user: SelfUser }>("/users/me", { coverMediaId: m.id });
      qc.setQueryData(["me"], u);
      refreshProfile();
      toast.success("Cover photo updated");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCoverBusy(false);
    }
  };

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
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border bg-card">
        {/* Cover */}
        <div className="relative">
          <button
            type="button"
            disabled={!user?.coverUrl || restricted}
            onClick={() => user?.coverUrl && setViewer(user.coverUrl)}
            className="block h-32 w-full bg-gradient-to-br from-identity/40 via-primary/20 to-anon/20 bg-cover bg-center sm:h-44"
            style={user?.coverUrl && !restricted ? { backgroundImage: `url(${user.coverUrl})` } : undefined}
            aria-label="View cover photo"
          />
          {isMe && (
            <>
              <Button size="sm" variant="secondary" className="absolute right-3 bottom-3 shadow" onClick={() => coverInput.current?.click()} disabled={coverBusy}>
                {coverBusy ? <Spinner /> : <Camera />} <span className="hidden sm:inline">{user?.coverUrl ? "Edit cover photo" : "Add cover photo"}</span>
              </Button>
              <input ref={coverInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ""; }} />
            </>
          )}
        </div>

        <div className="px-4 pb-5 sm:px-5">
          <div className="-mt-12 mb-3 flex items-end justify-between gap-3 sm:-mt-14">
            {/* Avatar */}
            <div className="relative">
              {user ? (
                <button
                  type="button"
                  onClick={() => user.avatarUrl && setViewer(user.avatarUrl)}
                  className="rounded-full"
                  aria-label="View profile picture"
                >
                  <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-24 border-4 border-card text-2xl sm:size-28" />
                </button>
              ) : (
                <Skeleton className="size-24 rounded-full border-4 border-card sm:size-28" />
              )}
              {locked && (
                <span className="absolute right-0 bottom-1 grid size-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground" title="Locked profile">
                  <Lock className="size-4" />
                </span>
              )}
              {isMe && !locked && (
                <button
                  type="button"
                  onClick={() => setAvatarOpen(true)}
                  className="absolute right-0 bottom-1 grid size-9 place-items-center rounded-full border-2 border-card bg-secondary shadow hover:bg-accent"
                  aria-label="Update profile picture"
                >
                  <Camera className="size-4" />
                </button>
              )}
            </div>

            {/* Actions */}
            {user && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isMe ? (
                  <>
                    <Button size="sm" onClick={() => setStoryOpen(true)}><Plus strokeWidth={2.75} /> Add to story</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-lg border p-1.5 hover:bg-accent" aria-label="Profile options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
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
                    {features.messagingEnabled && !user.blockedByMe && (
                      <Button size="sm" variant={user.friends.status === "none" || user.friends.status === "outgoing" ? "secondary" : "default"} onClick={() => message.mutate()} disabled={message.isPending}>
                        <Send /> <span className="hidden sm:inline">Message</span>
                      </Button>
                    )}
                    {user.blockedByMe && <Button size="sm" variant="outline" onClick={() => toggleBlock.mutate()}>Unblock</Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-lg border p-1.5 hover:bg-accent" aria-label="More options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
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

          {isLoading || !user ? (
            <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold break-all">{user.displayName}</h1>
                {user.isVerified && <VerifiedMark />}
                <RoleBadge role={user.role} />
              </div>
              <p className="text-sm text-muted-foreground">
                @{user.username}
                {user.friends.count !== null && (
                  <> · <button type="button" onClick={() => setTab("friends")} className="font-medium text-foreground hover:underline">{compact(user.friends.count)} friend{user.friends.count === 1 ? "" : "s"}</button></>
                )}
              </p>

              {isMe && locked && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                  <ShieldCheck className="size-4 shrink-0" /> You locked your profile. Only your friends can see your posts, bio and photos here.
                </p>
              )}

              {restricted ? null : (
                <>{user.bio && <p className="mt-3 text-[15px] whitespace-pre-wrap">{user.bio}</p>}</>
              )}
            </>
          )}
          {user && !isMe && !restricted && <MutualFriendsLine p={user} onOpen={() => setTab("friends")} />}
        </div>

        {/* Tabs */}
        {user && (
          <div className="flex overflow-x-auto border-t px-1 [scrollbar-width:none] sm:px-3">
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
          <>
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
          </>
        )}
        {user && tab === "reels" && (restricted ? <EmptyTab icon={<Clapperboard className="size-8" />} title="No reels to show" /> : <ReelsTab p={user} />)}
        {user && tab === "photos" && (restricted ? <EmptyTab icon={<ImageIcon className="size-8" />} title="No photos to show" /> : <PhotosTab p={user} />)}
        {user && tab === "posts" && (restricted ? <LockedCard name={user.displayName} /> : (
          <>
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 text-anon" />
              Profiles only show identity posts. Anonymous posts are never linked here.
            </div>
            <PostList
              queryKey={["profile-posts", user.username]}
              path={`/users/${user.username}/posts`}
              empty={<EmptyState title="No posts yet">{isMe ? "Your identity posts will appear here." : `@${user.username} hasn't posted yet.`}</EmptyState>}
            />
          </>
        ))}
      </div>

      {user?.isMe && <CreateStoryDialog open={storyOpen} onOpenChange={setStoryOpen} />}
      {user && !user.isMe && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ type: "user", id: user.username }} />}

      {/* Own profile: lock / unlock confirmation */}
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
