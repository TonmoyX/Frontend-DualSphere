"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, CalendarDays, Check, ChevronDown, Clock, Lock, LogOut, Search, Settings, ShieldAlert, ShieldCheck, UserPlus, UsersRound, VenetianMask } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { compact, EmptyState, Spinner, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { ANON_POLICY, CommunityIcon, VISIBILITY } from "@/components/community/community-bits";
import { CommunityPageContext } from "@/components/community/community-context";
import { PostList } from "@/components/post/feed";
import { PostComposer } from "@/components/post/post-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage, get, post } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Community, CommunityMember, CommunityRule, Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Tab = "posts" | "about" | "members";

export default function CommunityPage() {
  return <Suspense><CommunityInner /></Suspense>;
}

function RulesList({ rules }: { rules: CommunityRule[] }) {
  if (!rules.length) return <p className="text-sm text-muted-foreground">No rules yet.</p>;
  return (
    <ol className="space-y-2.5">
      {rules.map((r, i) => (
        <li key={r.id} className="flex gap-3 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
          <span>
            <span className="block font-medium">{r.title}</span>
            {r.body && <span className="block text-muted-foreground">{r.body}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function AboutCard({ c, rules }: { c: Community; rules: CommunityRule[] }) {
  const V = VISIBILITY[c.visibility];
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-2 text-lg font-bold">About</h2>
        {c.description ? <p className="mb-4 text-[15px] whitespace-pre-wrap">{c.description}</p> : <p className="mb-4 text-sm text-muted-foreground">No description yet.</p>}
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3"><V.Icon className="size-5 shrink-0 text-muted-foreground" /><span><b className="font-semibold">{V.label}</b><span className="block text-muted-foreground">{V.hint}</span></span></li>
          <li className="flex items-start gap-3"><VenetianMask className="size-5 shrink-0 text-muted-foreground" /><span><b className="font-semibold">{ANON_POLICY[c.anonPolicy].label}</b><span className="block text-muted-foreground">Anonymous authors stay hidden — even from the moderators</span></span></li>
          {c.postApproval && <li className="flex items-center gap-3"><Clock className="size-5 shrink-0 text-muted-foreground" /> Posts are approved by moderators first</li>}
          <li className="flex items-center gap-3"><UsersRound className="size-5 shrink-0 text-muted-foreground" /> <span><b className="font-semibold">{compact(c.memberCount)}</b> member{c.memberCount === 1 ? "" : "s"}</span></li>
          <li className="flex items-center gap-3"><CalendarDays className="size-5 shrink-0 text-muted-foreground" /> Created {new Date(c.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</li>
          {c.owner && (
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0 text-muted-foreground" />
              <span>Owner <Link href={`/profile/${c.owner.username}`} className="font-semibold hover:underline">{c.owner.displayName}</Link></span>
            </li>
          )}
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">Rules</h2>
        <RulesList rules={rules} />
      </section>
    </div>
  );
}

function MembersTab({ c }: { c: Community }) {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["community-members", c.slug, q],
    queryFn: () => get<{ members: CommunityMember[] }>(`/communities/${c.slug}/members${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    enabled: c.viewer.canSeeContent,
  });
  if (!c.viewer.canSeeContent) return <EmptyState icon={<Lock className="size-8" />} title="Members are private">Join to see who&apos;s here.</EmptyState>;
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Members · {compact(c.memberCount)}</h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Search members" className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
      {isLoading && <Spinner className="size-5" />}
      {error && <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {data?.members.map((m) => (
          <li key={m.id}>
            <Link href={`/profile/${m.username}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/50">
              <UserAvatar src={m.avatarUrl} name={m.displayName} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate font-semibold">{m.displayName} {m.isVerified && <VerifiedMark />}</span>
                <span className="block truncate text-sm text-muted-foreground">@{m.username}</span>
              </span>
              {m.communityRole !== "member" && (
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", m.communityRole === "owner" ? "bg-primary/15 text-primary" : "bg-muted")}>
                  {m.communityRole === "owner" ? "Owner" : "Moderator"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JoinButton({ c, invite, onChanged }: { c: Community; invite: string | null; onChanged: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [askOpen, setAskOpen] = useState(false);
  const [message, setMessage] = useState("");
  const join = useMutation({
    mutationFn: (msg?: string) => post<{ status: "member" | "requested" }>(`/communities/${c.slug}/join`, { ...(msg ? { message: msg } : {}), ...(invite ? { invite } : {}) }),
    onSuccess: (r) => {
      toast.success(r.status === "member" ? `Welcome to ${c.name}!` : "Request sent — a moderator will review it");
      setAskOpen(false);
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const leave = useMutation({
    mutationFn: () => post(`/communities/${c.slug}/leave`),
    onSuccess: () => { toast.success(c.viewer.hasRequested ? "Request cancelled" : `You left ${c.name}`); onChanged(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user) return <Button onClick={() => router.push(`/login?next=/c/${c.slug}`)}><UserPlus /> Join</Button>;
  if (c.viewer.isBanned) return <Button variant="secondary" disabled><Ban /> Banned</Button>;
  if (c.isSuspended && !c.viewer.isMember) return null;
  if (c.viewer.isMember) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary"><Check /> {c.viewer.isOwner ? "Owner" : c.viewer.role === "mod" ? "Moderator" : "Joined"} <ChevronDown className="opacity-60" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {c.viewer.isOwner ? (
            <DropdownMenuItem disabled className="flex-col items-start">
              <span>Leave community</span>
              <span className="text-xs text-muted-foreground">Transfer ownership first</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => leave.mutate()}><LogOut /> Leave community</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (c.viewer.hasRequested) {
    return <Button variant="secondary" onClick={() => leave.mutate()} disabled={leave.isPending}><Clock /> Requested · Cancel</Button>;
  }
  const needsApproval = c.visibility !== "public" && !invite;
  return (
    <>
      <Button onClick={() => (needsApproval ? setAskOpen(true) : join.mutate(undefined))} disabled={join.isPending}>
        {join.isPending ? <Spinner /> : <UserPlus />} {needsApproval ? "Request to join" : "Join"}
      </Button>
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request to join {c.name}</DialogTitle>
            <DialogDescription>Moderators review requests. You can add a short note.</DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="Why do you want to join? (optional)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>Cancel</Button>
            <Button onClick={() => join.mutate(message.trim() || undefined)} disabled={join.isPending}>{join.isPending && <Spinner />} Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommunityInner() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const invite = search.get("invite");
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const tab: Tab = (["posts", "about", "members"] as const).includes(search.get("tab") as Tab) ? (search.get("tab") as Tab) : "posts";
  const setTab = (t: Tab) => router.replace(`/c/${slug}${t === "posts" ? "" : `?tab=${t}`}${invite ? `${t === "posts" ? "?" : "&"}invite=${invite}` : ""}`, { scroll: false });

  const { data, isLoading, error } = useQuery({
    queryKey: ["community", slug.toLowerCase(), user?.id ?? "anon", invite],
    queryFn: () => get<{ community: Community; rules: CommunityRule[] }>(`/communities/${slug}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const c = data?.community;

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["community", slug.toLowerCase()] });
    qc.invalidateQueries({ queryKey: ["community-posts", slug] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  }, [qc, slug]);

  // Live posts for this community (the server only lets members of private communities in)
  useEffect(() => {
    if (!c?.id || !c.viewer.canSeeContent) return;
    const s = getSocket();
    s.emit("community:watch", c.id);
    const onPending = () => qc.invalidateQueries({ queryKey: ["community-pending", slug] });
    s.on("community:pending", onPending);
    return () => {
      s.emit("community:unwatch", c.id);
      s.off("community:pending", onPending);
    };
  }, [c?.id, c?.viewer.canSeeContent, qc, slug]);

  const accept = useCallback((p: Post) => p.community?.id === c?.id, [c?.id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={<UsersRound className="size-8" />} title="Community not found">
          It doesn&apos;t exist, or it&apos;s invite-only. <Link href="/communities" className="text-primary hover:underline">Browse communities</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <CommunityPageContext.Provider value={c ? { slug: c.slug, canModerate: c.viewer.canModerate } : null}>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border bg-card">
          <div
            className="h-36 bg-gradient-to-br from-identity/40 via-primary/20 to-anon/20 bg-cover bg-center sm:h-56"
            style={c?.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})` } : undefined}
          />
          <div className="px-4 pb-4 sm:px-8">
            <div className="-mt-10 flex flex-col gap-3 sm:-mt-12 sm:flex-row sm:items-end sm:gap-5">
              {c ? <CommunityIcon name={c.name} src={c.iconUrl} className="size-24 border-[5px] border-card text-4xl shadow-xl sm:size-28" /> : <Skeleton className="size-24 rounded-xl border-[5px] border-card sm:size-28" />}
              <div className="min-w-0 flex-1 sm:pt-14 sm:pb-1">
                {isLoading || !c ? (
                  <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-40" /></div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold break-words sm:text-3xl">{c.name}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">{(() => { const V = VISIBILITY[c.visibility]; return <><V.Icon className="size-4" /> {V.label}</>; })()}</span>
                      <span><b className="font-semibold text-foreground">{compact(c.memberCount)}</b> member{c.memberCount === 1 ? "" : "s"}</span>
                      <span>c/{c.slug}</span>
                    </p>
                  </>
                )}
              </div>
              {c && (
                <div className="flex flex-wrap items-center gap-2 sm:pb-1">
                  <JoinButton c={c} invite={invite} onChanged={refresh} />
                  {c.viewer.canModerate && (
                    <Button variant="secondary" asChild><Link href={`/c/${c.slug}/settings`}><Settings /> Manage</Link></Button>
                  )}
                </div>
              )}
            </div>

            {c?.isSuspended && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" /> This community was suspended by DualSphere staff{c.suspendedReason ? `: ${c.suspendedReason}` : "."}
              </p>
            )}
            {c?.viewer.mutedUntil && (
              <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                You&apos;re muted here until {new Date(c.viewer.mutedUntil).toLocaleString()}.
              </p>
            )}
          </div>

          <div className="flex overflow-x-auto border-t px-1 [scrollbar-width:none] sm:px-6">
            {(["posts", "about", "members"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("relative shrink-0 px-3 py-3 text-[15px] font-semibold capitalize transition-colors sm:px-4", tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {t}
                {tab === t && <motion.span layoutId="community-tab" className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </motion.div>

        {c && (
          <div className="mt-4">
            {tab === "posts" && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="min-w-0 space-y-3">
                  {!c.viewer.canSeeContent ? (
                    <EmptyState icon={<Lock className="size-8" />} title={c.isSuspended ? "This community is suspended" : "This community is private"}>
                      {c.isSuspended ? "Posts are hidden while it's suspended." : c.viewer.hasRequested ? "Your request is waiting for a moderator." : "Join to see and write posts."}
                    </EmptyState>
                  ) : (
                    <>
                      {c.viewer.canPost && (
                        <PostComposer
                          key={`composer-${c.id}`}
                          defaultMode={c.anonPolicy === "anon_only" ? "anonymous" : "identity"}
                          community={{ id: c.id, slug: c.slug, name: c.name, anonPolicy: c.anonPolicy, visibility: c.visibility }}
                          onPosted={() => qc.invalidateQueries({ queryKey: ["community-posts", c.slug] })}
                        />
                      )}
                      <PostList
                        key={c.id}
                        queryKey={["community-posts", c.slug]}
                        path={`/communities/${c.slug}/posts`}
                        live
                        accept={accept}
                        empty={<EmptyState icon={<UsersRound className="size-8" />} title="No posts yet">{c.viewer.canPost ? "Start the conversation." : "Join to start the conversation."}</EmptyState>}
                      />
                    </>
                  )}
                </div>
                <aside className="hidden lg:sticky lg:top-20 lg:block">
                  <AboutCard c={c} rules={data.rules} />
                </aside>
              </div>
            )}
            {tab === "about" && <div className="mx-auto max-w-2xl"><AboutCard c={c} rules={data.rules} /></div>}
            {tab === "members" && <MembersTab c={c} />}
          </div>
        )}
      </div>
    </CommunityPageContext.Provider>
  );
}
