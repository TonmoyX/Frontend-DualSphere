"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, Cake, CalendarDays, FileText, GraduationCap, Heart, ImageIcon, Link2, Lock, MapPin, Rss, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { compact } from "@/components/common/bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { get } from "@/lib/api";
import type { FriendCard, Photo, Profile } from "@/lib/types";
import { formatBirthday } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Tab = "posts" | "friends" | "photos" | "reels" | "anonymous";

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-bold tracking-normal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AboutGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function AboutRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg:not([class*='text-'])]:text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}

const joined = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Left column on the Posts tab: intro, photo and friend previews. */
export function ProfileSidebar({ p, isMe, onTab }: { p: Profile; isMe: boolean; onTab: (t: Tab) => void }) {
  const { user: me } = useAuth();
  const viewer = me?.id ?? "anon";
  const [aboutOpen, setAboutOpen] = useState(false);

  const photos = useQuery({
    queryKey: ["photos-preview", p.username.toLowerCase(), viewer],
    queryFn: () => get<{ photos: Photo[] }>(`/users/${p.username}/photos?page=1&limit=9`),
  });
  // Same key and shape as the Friends tab, so switching tabs is instant
  const friends = useQuery({
    queryKey: ["friends", "of", p.username.toLowerCase(), viewer],
    queryFn: () => get<{ mode: "all" | "mutual" | "hidden" | "locked"; friends: FriendCard[] }>(`/users/${p.username}/friends`),
  });

  const photoList = photos.data?.photos ?? [];
  const friendList = friends.data?.friends ?? [];
  const friendsTitle = friends.data?.mode === "mutual" ? "Mutual friends" : "Friends";

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${p.username}`);
    toast.success("Profile link copied");
  };

  return (
    <div className="space-y-4">
      <Card title="Intro" action={isMe ? <Link href="/settings" className="text-sm font-medium text-primary hover:underline">Edit</Link> : undefined}>
        {p.bio ? (
          <p className="mb-4 text-center text-[15px] whitespace-pre-wrap">{p.bio}</p>
        ) : isMe ? (
          <Link href="/settings" className="mb-4 block rounded-lg bg-muted py-2 text-center text-sm font-medium hover:bg-accent">Add bio</Link>
        ) : null}
        <ul className="space-y-3 text-sm">
          {p.work && <li className="flex items-start gap-3"><Briefcase className="size-5 shrink-0 text-muted-foreground" /> <span>Works as <b className="font-semibold">{p.work}</b></span></li>}
          {p.education && <li className="flex items-start gap-3"><GraduationCap className="size-5 shrink-0 text-muted-foreground" /> <span>Studied <b className="font-semibold">{p.education}</b></span></li>}
          {p.location && <li className="flex items-start gap-3"><MapPin className="size-5 shrink-0 text-muted-foreground" /> <span>Lives in <b className="font-semibold">{p.location}</b></span></li>}
          <li className="flex items-center gap-3"><CalendarDays className="size-5 shrink-0 text-muted-foreground" /> Joined {joined(p.createdAt)}</li>
          {p.birthday && <li className="flex items-center gap-3"><Cake className="size-5 shrink-0 text-muted-foreground" /> <span>Born on <b className="font-semibold">{formatBirthday(p.birthday)}</b></span></li>}
          {p.follow?.followers != null && (
            <li className="flex items-center gap-3">
              <Rss className="size-5 shrink-0 text-muted-foreground" />
              <span>Followed by <b className="font-semibold">{compact(p.follow.followers)}</b> {p.follow.followers === 1 ? "person" : "people"}</span>
            </li>
          )}
          {p.profileLocked && <li className="flex items-center gap-3"><Lock className="size-5 shrink-0 text-muted-foreground" /> Locked profile</li>}
          {isMe && !p.work && !p.education && !p.location && !p.hobbies?.length && (
            <li><Link href="/settings" className="block rounded-lg bg-muted py-2 text-center text-sm font-medium hover:bg-accent">Add work, education &amp; hobbies</Link></li>
          )}
        </ul>
        <button type="button" onClick={() => setAboutOpen(true)} className="mt-4 w-full rounded-lg bg-muted py-2 text-sm font-medium hover:bg-accent">
          See all
        </button>
      </Card>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>About {p.displayName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1 text-sm">
            {p.bio && <p className="text-[15px] whitespace-pre-wrap">{p.bio}</p>}

            {(p.work || p.education || p.location) && (
              <AboutGroup title="Work, education & places">
                {p.work && <AboutRow icon={<Briefcase />}>Works as <b className="font-semibold">{p.work}</b></AboutRow>}
                {p.education && <AboutRow icon={<GraduationCap />}>Studied <b className="font-semibold">{p.education}</b></AboutRow>}
                {p.location && <AboutRow icon={<MapPin />}>Lives in <b className="font-semibold">{p.location}</b></AboutRow>}
              </AboutGroup>
            )}

            {p.hobbies?.length > 0 && (
              <AboutGroup title="Hobbies">
                <div className="flex flex-wrap gap-1.5">
                  {p.hobbies.map((h) => <span key={h} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]"><Heart className="size-3.5 text-muted-foreground" />{h}</span>)}
                </div>
              </AboutGroup>
            )}

            <AboutGroup title="Account">
              {p.birthday && <AboutRow icon={<Cake />}>Born on <b className="font-semibold">{formatBirthday(p.birthday)}</b></AboutRow>}
              <AboutRow icon={<CalendarDays />}>Joined {joined(p.createdAt)}</AboutRow>
              <AboutRow icon={<FileText />}><b className="font-semibold">{compact(p.postCount)}</b> post{p.postCount === 1 ? "" : "s"}</AboutRow>
              {p.friends.count !== null && <AboutRow icon={<Users />}><b className="font-semibold">{compact(p.friends.count)}</b> friend{p.friends.count === 1 ? "" : "s"}</AboutRow>}
              {p.follow?.followers != null && <AboutRow icon={<Rss />}>Followed by <b className="font-semibold">{compact(p.follow.followers)}</b> {p.follow.followers === 1 ? "person" : "people"}</AboutRow>}
              {p.isVerified && <AboutRow icon={<BadgeCheck className="text-primary" />}>Verified account</AboutRow>}
              {p.profileLocked && <AboutRow icon={<Lock />}>Locked profile</AboutRow>}
            </AboutGroup>

            <AboutGroup title="Profile link">
              <button type="button" onClick={copyLink} className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-accent">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">dualsphere/profile/{p.username}</span>
                <span className="text-xs font-medium text-primary">Copy</span>
              </button>
            </AboutGroup>

            {isMe && <Link href="/settings" className="block rounded-lg bg-muted py-2 text-center font-medium hover:bg-accent">Edit details</Link>}
          </div>
        </DialogContent>
      </Dialog>

      <Card title="Photos" action={photoList.length > 0 && <button type="button" onClick={() => onTab("photos")} className="text-sm font-medium text-primary hover:underline">See all photos</button>}>
        {photos.isLoading ? (
          <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />)}</div>
        ) : photoList.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><ImageIcon className="size-4" /> No photos yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
            {photoList.map((ph) => (
              <button key={ph.url} type="button" onClick={() => onTab("photos")} className="group aspect-square overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {friends.data && friends.data.mode !== "hidden" && friends.data.mode !== "locked" && (
        <Card title={friendsTitle} action={friendList.length > 0 && <button type="button" onClick={() => onTab("friends")} className="text-sm font-medium text-primary hover:underline">See all</button>}>
          {friends.data.mode === "all" && <p className="-mt-2 mb-3 text-sm text-muted-foreground">{friendList.length} friend{friendList.length === 1 ? "" : "s"}</p>}
          {friendList.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4" /> {isMe ? "Find people you know on the Friends page." : "No friends to show"}</p>
          ) : (
            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
              {friendList.slice(0, 9).map((f) => (
                <Link key={f.id} href={`/profile/${f.username}`} className="group min-w-0">
                  <div className="aspect-square overflow-hidden rounded-xl bg-identity/15">
                    {f.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatarUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="grid size-full place-items-center text-lg font-semibold text-identity">
                        {f.displayName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block truncate text-xs font-semibold group-hover:underline">{f.displayName}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
