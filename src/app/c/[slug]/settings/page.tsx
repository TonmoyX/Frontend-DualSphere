"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Camera, Check, ClipboardList, Copy, Crown, FileClock, Gavel, Link2, ListOrdered, MoreHorizontal, Plus, Settings, ShieldCheck, Trash2, UserMinus, UserRoundCheck, UsersRound, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner, TimeAgo, UserAvatar } from "@/components/common/bits";
import { ANON_POLICY, CommunityIcon, VISIBILITY } from "@/components/community/community-bits";
import { CommunityPageContext } from "@/components/community/community-context";
import { PostCard } from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, patch, post, put } from "@/lib/api";
import type { AnonPolicy, Community, CommunityMember, CommunityRule, CommunityVisibility, Post, PublicUser } from "@/lib/types";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Section = "requests" | "pending" | "members" | "bans" | "invites" | "rules" | "log" | "settings" | "danger";

function Card({ title, desc, children, action }: { title: string; desc?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; hint: string }[]; disabled?: boolean }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={disabled}
          onClick={() => onChange(o.v)}
          className={cn("rounded-xl border-2 p-2.5 text-left transition-colors", value === o.v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border")}
        >
          <span className="block text-sm font-semibold">{o.label}</span>
          <span className="block text-xs text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

// ── Join requests ──
function RequestsSection({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["community-requests", slug], queryFn: () => get<{ requests: (PublicUser & { message: string; requestedAt: string })[] }>(`/communities/${slug}/requests`) });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => post(`/communities/${slug}/requests/${id}`, { approve }),
    onSuccess: (_r, v) => { toast.success(v.approve ? "Approved" : "Declined"); qc.invalidateQueries({ queryKey: ["community-requests", slug] }); onChanged(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card title="Join requests" desc="People asking to join. Approve the ones who belong here.">
      {isLoading && <Spinner className="size-5" />}
      {data?.requests.length === 0 && <p className="text-sm text-muted-foreground">No requests right now.</p>}
      <ul className="divide-y">
        {data?.requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <UserAvatar src={r.avatarUrl} name={r.displayName} className="size-10" />
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${r.username}`} className="font-semibold hover:underline">{r.displayName}</Link>
              <span className="ml-1.5 text-sm text-muted-foreground">@{r.username} · <TimeAgo date={r.requestedAt} /></span>
              {r.message && <p className="mt-0.5 text-sm break-words">“{r.message}”</p>}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => decide.mutate({ id: r.id, approve: true })} disabled={decide.isPending}><Check /> Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: r.id, approve: false })} disabled={decide.isPending}><X /> Decline</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Posts waiting for approval ──
function PendingSection({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["community-pending", slug], queryFn: () => get<{ posts: Post[] }>(`/communities/${slug}/pending`) });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => post(`/communities/${slug}/posts/${id}/decision`, { approve, reason }),
    onSuccess: (_r, v) => {
      toast.success(v.approve ? "Approved — it's live" : "Rejected");
      setRejecting(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["community-pending", slug] });
      qc.invalidateQueries({ queryKey: ["community-posts", slug] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card title="Posts waiting for approval" desc="Anonymous posts stay anonymous here — you can approve or reject them, but never see who wrote them.">
      {isLoading && <Spinner className="size-5" />}
      {data?.posts.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting. 🎉</p>}
      <div className="space-y-3">
        {data?.posts.map((p) => (
          <div key={p.id} className="space-y-2">
            <PostCard post={p} variant="detail" />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => decide.mutate({ id: p.id, approve: true })} disabled={decide.isPending}><Check /> Approve</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(p.id)} disabled={decide.isPending}><X /> Reject</Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject post</DialogTitle>
            <DialogDescription>If it was posted with a name, the author sees this reason.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (optional)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejecting && decide.mutate({ id: rejecting, approve: false, reason: reason.trim() || undefined })} disabled={decide.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Members ──
function MembersSection({ c, onChanged }: { c: Community; onChanged: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<{ m: CommunityMember; ban: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["community-members", c.slug, q],
    queryFn: () => get<{ members: CommunityMember[] }>(`/communities/${c.slug}/members${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["community-members", c.slug] }); onChanged(); };
  const role = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "mod" | "member" }) => put(`/communities/${c.slug}/members/${id}/role`, { role }),
    onSuccess: (_r, v) => done(v.role === "mod" ? "Now a moderator" : "Moderator role removed"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mute = useMutation({
    mutationFn: ({ id, hours }: { id: string; hours: number }) => post(`/communities/${c.slug}/members/${id}/mute`, { hours }),
    onSuccess: (_r, v) => done(v.hours ? `Muted for ${v.hours >= 24 ? `${v.hours / 24} day${v.hours > 24 ? "s" : ""}` : `${v.hours} hours`}` : "Unmuted"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => post(`/communities/${c.slug}/members/${removing!.m.id}/remove`, { ban: removing!.ban, reason }),
    onSuccess: () => { done(removing!.ban ? "Removed and banned" : "Removed"); setRemoving(null); setReason(""); qc.invalidateQueries({ queryKey: ["community-bans", c.slug] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const myRank = c.viewer.isOwner ? 3 : c.viewer.role === "mod" ? 2 : 1;
  const rank = (r: CommunityMember["communityRole"]) => (r === "owner" ? 3 : r === "mod" ? 2 : 1);

  return (
    <Card
      title={`Members · ${c.memberCount}`}
      desc="You can act on anyone below your own role. Owners promote moderators."
      action={<Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Search members" className="w-full sm:w-56" />}
    >
      {isLoading && <Spinner className="size-5" />}
      <ul className="divide-y">
        {data?.members.map((m) => {
          const canAct = m.id !== user?.id && rank(m.communityRole) < myRank;
          return (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <UserAvatar src={m.avatarUrl} name={m.displayName} className="size-10" />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${m.username}`} className="font-semibold hover:underline">{m.displayName}</Link>
                <span className="ml-1.5 text-sm text-muted-foreground">@{m.username}</span>
                <div className="text-xs text-muted-foreground">
                  Joined <TimeAgo date={m.joinedAt} />
                  {m.mutedUntil && <span className="ml-1.5 text-amber-600 dark:text-amber-400">· muted until {new Date(m.mutedUntil).toLocaleString()}</span>}
                </div>
              </div>
              {m.communityRole !== "member" && (
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", m.communityRole === "owner" ? "bg-primary/15 text-primary" : "bg-muted")}>
                  {m.communityRole === "owner" ? "Owner" : "Moderator"}
                </span>
              )}
              {canAct && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-accent" aria-label={`Actions for ${m.displayName}`}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {c.viewer.isOwner && (
                      m.communityRole === "mod"
                        ? <DropdownMenuItem onSelect={() => role.mutate({ id: m.id, role: "member" })}><UserMinus /> Remove moderator role</DropdownMenuItem>
                        : <DropdownMenuItem onSelect={() => role.mutate({ id: m.id, role: "mod" })}><ShieldCheck /> Make moderator</DropdownMenuItem>
                    )}
                    {m.mutedUntil
                      ? <DropdownMenuItem onSelect={() => mute.mutate({ id: m.id, hours: 0 })}><VolumeX /> Unmute</DropdownMenuItem>
                      : (
                        <>
                          <DropdownMenuItem onSelect={() => mute.mutate({ id: m.id, hours: 24 })}><VolumeX /> Mute for 1 day</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => mute.mutate({ id: m.id, hours: 168 })}><VolumeX /> Mute for 7 days</DropdownMenuItem>
                        </>
                      )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setRemoving({ m, ban: false })}><UserMinus /> Remove from community</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setRemoving({ m, ban: true })}><Ban /> Remove and ban</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog open={!!removing} onOpenChange={(o) => !o && !remove.isPending && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{removing?.ban ? "Remove and ban" : "Remove member"} · {removing?.m.displayName}</DialogTitle>
            <DialogDescription>{removing?.ban ? "They're removed and can't rejoin until a moderator unbans them." : "They're removed but can join again."}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (kept in the mod log)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={remove.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending && <Spinner />} {removing?.ban ? "Remove and ban" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Bans ──
function BansSection({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["community-bans", slug], queryFn: () => get<{ bans: (PublicUser & { reason: string; bannedAt: string })[] }>(`/communities/${slug}/bans`) });
  const unban = useMutation({
    mutationFn: (id: string) => del(`/communities/${slug}/bans/${id}`),
    onSuccess: () => { toast.success("Unbanned"); qc.invalidateQueries({ queryKey: ["community-bans", slug] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card title="Banned" desc="Banned people can't see private posts or rejoin.">
      {isLoading && <Spinner className="size-5" />}
      {data?.bans.length === 0 && <p className="text-sm text-muted-foreground">No one is banned.</p>}
      <ul className="divide-y">
        {data?.bans.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2.5">
            <UserAvatar src={b.avatarUrl} name={b.displayName} className="size-10" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{b.displayName}</span> <span className="text-sm text-muted-foreground">@{b.username} · <TimeAgo date={b.bannedAt} /></span>
              {b.reason && <p className="text-sm text-muted-foreground">{b.reason}</p>}
            </div>
            <Button size="sm" variant="secondary" onClick={() => unban.mutate(b.id)} disabled={unban.isPending}>Unban</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Invite links ──
function InvitesSection({ c }: { c: Community }) {
  const qc = useQueryClient();
  const [maxUses, setMaxUses] = useState(50);
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ["community-invites", c.slug],
    queryFn: () => get<{ invites: { code: string; maxUses: number; uses: number; expiresAt: string; createdBy: string | null }[] }>(`/communities/${c.slug}/invites`),
  });
  const link = (code: string) => `${window.location.origin}/c/${c.slug}?invite=${code}`;
  const create = useMutation({
    mutationFn: () => post<{ code: string }>(`/communities/${c.slug}/invites`, { maxUses, expiresInDays: days }),
    onSuccess: ({ code }) => {
      navigator.clipboard.writeText(link(code)).catch(() => {});
      toast.success("Invite link created and copied");
      qc.invalidateQueries({ queryKey: ["community-invites", c.slug] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (code: string) => del(`/communities/${c.slug}/invites/${code}`),
    onSuccess: () => { toast.success("Link revoked"); qc.invalidateQueries({ queryKey: ["community-invites", c.slug] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card title="Invite links" desc={c.visibility === "public" ? "Anyone can join a public community, but links are handy to share." : "People with a link join without waiting for approval. Share them only with people you trust."}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="inv-uses" className="text-xs">Max uses</Label>
          <Input id="inv-uses" type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="w-28" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="inv-days" className="text-xs">Expires after (days)</Label>
          <Input id="inv-days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className="w-28" />
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Spinner /> : <Plus />} New link</Button>
      </div>
      {isLoading && <Spinner className="size-5" />}
      {data?.invites.length === 0 && <p className="text-sm text-muted-foreground">No active links.</p>}
      <ul className="divide-y">
        {data?.invites.map((i) => (
          <li key={i.code} className="flex flex-wrap items-center gap-3 py-2.5">
            <Link2 className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <code className="block truncate text-xs">{`…/c/${c.slug}?invite=${i.code.slice(0, 6)}…`}</code>
              <span className="text-xs text-muted-foreground">{i.uses}/{i.maxUses} used · expires {new Date(i.expiresAt).toLocaleDateString()}{i.createdBy ? ` · by @${i.createdBy}` : ""}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(link(i.code)); toast.success("Copied"); }}><Copy /> Copy</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke.mutate(i.code)} disabled={revoke.isPending}>Revoke</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Rules ──
function RulesSection({ slug, initial, onSaved }: { slug: string; initial: CommunityRule[]; onSaved: () => void }) {
  const [rules, setRules] = useState(initial.map((r) => ({ title: r.title, body: r.body })));
  const save = useMutation({
    mutationFn: () => put(`/communities/${slug}/rules`, { rules: rules.filter((r) => r.title.trim()) }),
    onSuccess: () => { toast.success("Rules saved"); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card title="Rules" desc="Shown on the community page. Up to 15.">
      <ol className="space-y-3">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
            <div className="flex-1 space-y-1.5">
              <Input value={r.title} maxLength={100} placeholder="Rule title" onChange={(e) => setRules((cur) => cur.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Textarea value={r.body} maxLength={500} placeholder="Details (optional)" className="min-h-14" onChange={(e) => setRules((cur) => cur.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
            </div>
            <button type="button" onClick={() => setRules((cur) => cur.filter((_, j) => j !== i))} className="mt-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label={`Delete rule ${i + 1}`}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setRules((cur) => [...cur, { title: "", body: "" }])} disabled={rules.length >= 15}><Plus /> Add rule</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Spinner />} Save rules</Button>
      </div>
    </Card>
  );
}

// ── Mod log ──
function LogSection({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["community-modlog", slug],
    queryFn: () => get<{ entries: { id: number; action: string; reason: string | null; createdAt: string; actor: string | null; target: string | null }[] }>(`/communities/${slug}/modlog`),
  });
  return (
    <Card title="Mod log" desc="Everything the owner and moderators did. DualSphere staff can see this too.">
      {isLoading && <Spinner className="size-5" />}
      {data?.entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
      <ul className="divide-y text-sm">
        {data?.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
            <span className="font-medium">@{e.actor ?? "deleted"}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{e.action}</span>
            {e.target && <span>→ @{e.target}</span>}
            {e.reason && <span className="text-muted-foreground">“{e.reason}”</span>}
            <span className="ml-auto text-xs text-muted-foreground"><TimeAgo date={e.createdAt} /></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Owner settings ──
function SettingsSection({ c, onSaved }: { c: Community; onSaved: () => void }) {
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [visibility, setVisibility] = useState<CommunityVisibility>(c.visibility);
  const [anonPolicy, setAnonPolicy] = useState<AnonPolicy>(c.anonPolicy);
  const [postApproval, setPostApproval] = useState(c.postApproval);
  const [tags, setTags] = useState(c.tags.join(", "));
  const [uploading, setUploading] = useState<"icon" | "banner" | null>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch(`/communities/${c.slug}`, body),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = async (file: File | undefined, kind: "icon" | "banner") => {
    if (!file) return;
    setUploading(kind);
    try {
      const m = await uploadMedia(file, "community");
      await save.mutateAsync(kind === "icon" ? { iconMediaId: m.id } : { bannerMediaId: m.id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(null);
    }
  };

  return (
    <Card title="Community settings" desc="Only the owner can change these.">
      <div className="mb-5 overflow-hidden rounded-xl border">
        <div className="relative h-28 bg-gradient-to-br from-identity/40 via-primary/20 to-anon/20 bg-cover bg-center" style={c.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})` } : undefined}>
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => bannerRef.current?.click()} disabled={!!uploading}>{uploading === "banner" ? <Spinner /> : <Camera />} Banner</Button>
            {c.bannerUrl && <Button size="xs" variant="secondary" onClick={() => save.mutate({ bannerMediaId: null })}>Remove</Button>}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3">
          <CommunityIcon name={c.name} src={c.iconUrl} className="size-14 text-xl" />
          <Button size="sm" variant="secondary" onClick={() => iconRef.current?.click()} disabled={!!uploading}>{uploading === "icon" ? <Spinner /> : <Camera />} Change icon</Button>
          {c.iconUrl && <Button size="sm" variant="ghost" onClick={() => save.mutate({ iconMediaId: null })}>Remove</Button>}
        </div>
        <input ref={iconRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { upload(e.target.files?.[0], "icon"); e.target.value = ""; }} />
        <input ref={bannerRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { upload(e.target.files?.[0], "banner"); e.target.value = ""; }} />
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ name, description, visibility, anonPolicy, postApproval, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5) });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cs-name">Name</Label>
          <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-desc">Description</Label>
          <Textarea id="cs-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-24" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-tags">Tags</Label>
          <Input id="cs-tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={150} placeholder="campus, cse, dhaka (up to 5, comma separated)" />
        </div>
        <div className="space-y-1.5">
          <Label>Who can see it?</Label>
          <Choice value={visibility} onChange={setVisibility} options={(Object.keys(VISIBILITY) as CommunityVisibility[]).map((v) => ({ v, label: VISIBILITY[v].label, hint: VISIBILITY[v].hint }))} />
        </div>
        <div className="space-y-1.5">
          <Label>How can members post?</Label>
          <Choice value={anonPolicy} onChange={setAnonPolicy} options={(Object.keys(ANON_POLICY) as AnonPolicy[]).map((v) => ({ v, ...ANON_POLICY[v] }))} />
        </div>
        <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
          <span>
            <span className="block text-sm font-medium">Approve posts before they appear</span>
            <span className="block text-xs text-muted-foreground">Posts by members wait for you or a moderator</span>
          </span>
          <Switch checked={postApproval} onCheckedChange={setPostApproval} />
        </label>
        <Button disabled={save.isPending || name.trim().length < 3}>{save.isPending && <Spinner />} Save settings</Button>
      </form>
    </Card>
  );
}

// ── Owner danger zone ──
function DangerSection({ c, onChanged }: { c: Community; onChanged: () => void }) {
  const router = useRouter();
  const [transferTo, setTransferTo] = useState<CommunityMember | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["community-members", c.slug, ""], queryFn: () => get<{ members: CommunityMember[] }>(`/communities/${c.slug}/members`) });
  const candidates = (data?.members ?? []).filter((m) => m.communityRole !== "owner");

  const transfer = useMutation({
    mutationFn: () => post(`/communities/${c.slug}/transfer`, { userId: transferTo!.id }),
    onSuccess: () => { toast.success(`${transferTo!.displayName} is now the owner`); setTransferTo(null); onChanged(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/communities/${c.slug}`, { confirmName }),
    onSuccess: () => { toast.success("Community deleted"); router.push("/communities"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Card title="Transfer ownership" desc="You become a moderator. This can't be undone by you — only the new owner can give it back.">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Invite someone first — the new owner must be a member.</p>
        ) : (
          <ul className="divide-y">
            {candidates.slice(0, 50).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <UserAvatar src={m.avatarUrl} name={m.displayName} className="size-9" />
                <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{m.displayName}</b> <span className="text-sm text-muted-foreground">@{m.username}{m.communityRole === "mod" ? " · Moderator" : ""}</span></span>
                <Button size="sm" variant="secondary" onClick={() => setTransferTo(m)}><Crown /> Make owner</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Delete community" desc="Hides the community and all its posts from everyone. DualSphere staff can restore it if you contact support.">
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete community</Button>
      </Card>

      <Dialog open={!!transferTo} onOpenChange={(o) => !o && !transfer.isPending && setTransferTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make {transferTo?.displayName} the owner?</DialogTitle>
            <DialogDescription>They get full control of {c.name}, including deleting it. You&apos;ll become a moderator.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferTo(null)} disabled={transfer.isPending}>Cancel</Button>
            <Button onClick={() => transfer.mutate()} disabled={transfer.isPending}>{transfer.isPending && <Spinner />} Transfer ownership</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={(o) => !remove.isPending && setDeleteOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {c.name}?</DialogTitle>
            <DialogDescription>Type the community name to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={c.name} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={remove.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending || confirmName.trim() !== c.name}>{remove.isPending && <Spinner />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommunitySettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>("requests");

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/c/${slug}/settings`);
  }, [loading, user, router, slug]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["community", slug.toLowerCase(), user?.id ?? "anon", null],
    queryFn: () => get<{ community: Community; rules: CommunityRule[] }>(`/communities/${slug}`),
    enabled: !!user,
  });
  const c = data?.community;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["community", slug.toLowerCase()] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  };

  if (isLoading || loading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  if (error || !c) return <div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title="Community not found" /></div>;
  if (!c.viewer.canModerate) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={<ShieldCheck className="size-8" />} title="Moderators only">
          {c.isSuspended ? "This community is suspended." : "Only the owner and moderators can manage this community."} <Link href={`/c/${c.slug}`} className="text-primary hover:underline">Back to {c.name}</Link>
        </EmptyState>
      </div>
    );
  }

  const nav: { v: Section; label: string; Icon: typeof Settings; owner?: boolean }[] = [
    { v: "requests", label: "Join requests", Icon: UserRoundCheck },
    { v: "pending", label: "Waiting for approval", Icon: FileClock },
    { v: "members", label: "Members", Icon: UsersRound },
    { v: "bans", label: "Banned", Icon: Ban },
    { v: "invites", label: "Invite links", Icon: Link2 },
    { v: "rules", label: "Rules", Icon: ListOrdered },
    { v: "log", label: "Mod log", Icon: ClipboardList },
    { v: "settings", label: "Settings", Icon: Settings, owner: true },
    { v: "danger", label: "Ownership & delete", Icon: Gavel, owner: true },
  ];

  return (
    <CommunityPageContext.Provider value={{ slug: c.slug, canModerate: c.viewer.canModerate }}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CommunityIcon name={c.name} src={c.iconUrl} className="size-12 text-lg" />
            <div>
              <h1 className="text-xl font-bold">Manage {c.name}</h1>
              <p className="text-sm text-muted-foreground">You&apos;re the {c.viewer.isOwner ? "owner" : "moderator"}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" asChild><Link href={`/c/${c.slug}`}><ArrowLeft /> Back to community</Link></Button>
        </div>
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible [scrollbar-width:none]">
            {nav.filter((n) => !n.owner || c.viewer.isOwner).map((n) => (
              <button
                key={n.v}
                onClick={() => setSection(n.v)}
                className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors", section === n.v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                <n.Icon className="size-4" /> {n.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0">
            {section === "requests" && <RequestsSection slug={c.slug} onChanged={refresh} />}
            {section === "pending" && <PendingSection slug={c.slug} />}
            {section === "members" && <MembersSection c={c} onChanged={refresh} />}
            {section === "bans" && <BansSection slug={c.slug} />}
            {section === "invites" && <InvitesSection c={c} />}
            {section === "rules" && <RulesSection key={data.rules.map((r) => r.id).join()} slug={c.slug} initial={data.rules} onSaved={refresh} />}
            {section === "log" && <LogSection slug={c.slug} />}
            {section === "settings" && c.viewer.isOwner && <SettingsSection key={c.id + c.name} c={c} onSaved={refresh} />}
            {section === "danger" && c.viewer.isOwner && <DangerSection c={c} onChanged={refresh} />}
          </div>
        </div>
      </div>
    </CommunityPageContext.Provider>
  );
}
