"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Heart, Pencil, Plus, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner, UserAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, get, patch, post } from "@/lib/api";
import type { Currency, Tier } from "@/lib/types";
import { formatMoney, toMinor } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface Me { creator: { isActive: boolean; tagline: string; tipsEnabled: boolean; kycStatus: string; currency: Currency } | null; tiers: Tier[] }
interface MyMembership { id: string; status: "active" | "canceled"; currentPeriodEnd: string; tierName: string; priceMinor: number; currency: Currency; creator: { id: string; username: string; displayName: string; avatarUrl: string | null } }

function TierDialog({ tier, open, onOpenChange }: { tier: Tier | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(tier?.name ?? "");
  const [price, setPrice] = useState(tier ? String(tier.priceMinor / 100) : "5");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [benefits, setBenefits] = useState((tier?.benefits ?? []).join("\n"));
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, priceMinor: toMinor(price), benefits: benefits.split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 8) };
      return tier ? patch(`/creators/me/tiers/${tier.id}`, body) : post("/creators/me/tiers", body);
    },
    onSuccess: () => { toast.success(tier ? "Tier updated" : "Tier created"); qc.invalidateQueries({ queryKey: ["creator-me"] }); onOpenChange(false); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const minor = toMinor(price);
  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tier ? "Edit tier" : "New membership tier"}</DialogTitle>
          <DialogDescription>Members pay monthly. A new price applies to new payments and renewals.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="t-name">Name</Label><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Supporter" /></div>
          <div className="space-y-1.5"><Label htmlFor="t-price">Price per month ($)</Label><Input id="t-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="min-h-16" /></div>
          <div className="space-y-1.5"><Label htmlFor="t-ben">Benefits (one per line)</Label><Textarea id="t-ben" value={benefits} onChange={(e) => setBenefits(e.target.value)} className="min-h-20" placeholder={"Members-only posts\nEarly access"} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || name.trim().length < 2 || !Number.isFinite(minor) || minor < 100}>{save.isPending && <Spinner />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CreatorStudioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [tierDialog, setTierDialog] = useState<{ tier: Tier | null } | null>(null);
  const [tagline, setTagline] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login?next=/creator"); }, [loading, user, router]);
  const me = useQuery({ queryKey: ["creator-me", user?.id], queryFn: () => get<Me>("/creators/me"), enabled: !!user });
  const memberships = useQuery({ queryKey: ["my-memberships", user?.id], queryFn: () => get<{ memberships: MyMembership[] }>("/creators/memberships"), enabled: !!user });

  const become = useMutation({
    mutationFn: () => post<Me>("/creators/me", { tagline }),
    onSuccess: () => { toast.success("Creator tools are on 🎉"); qc.invalidateQueries({ queryKey: ["creator-me"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch<Me>("/creators/me", body),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["creator-me"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggleTier = useMutation({
    mutationFn: (t: Tier) => patch(`/creators/me/tiers/${t.id}`, { isActive: !t.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-me"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: (creatorId: string) => post(`/creators/memberships/${creatorId}/cancel`),
    onSuccess: () => { toast.success("Membership won't renew. You keep access until the end of the month."); qc.invalidateQueries({ queryKey: ["my-memberships"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user || me.isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  const c = me.data?.creator;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="size-6 text-primary" /> Creator studio</h1>
        {c && (
          <div className="flex gap-2">
            <Button variant="secondary" asChild><Link href="/creator/dashboard"><BarChart3 /> Dashboard</Link></Button>
            <Button variant="secondary" asChild><Link href="/wallet"><Wallet /> Wallet</Link></Button>
          </div>
        )}
      </div>

      {!c ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Earn from your fans</h2>
          <ul className="my-3 space-y-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="size-4 text-primary" /> Monthly memberships with up to 5 tiers</li>
            <li className="flex gap-2"><Check className="size-4 text-primary" /> Tips on your posts and profile</li>
            <li className="flex gap-2"><Check className="size-4 text-primary" /> Paid and members-only posts</li>
            <li className="flex gap-2"><ShieldCheck className="size-4 text-primary" /> Payouts by bank transfer (US dollars) after an identity check</li>
          </ul>
          <p className="mb-4 text-xs text-muted-foreground">Only posts with your name can earn — anonymous posts are never paid or tipped. DualSphere keeps a small platform fee; earnings unlock after a short refund window.</p>
          <div className="flex flex-wrap gap-2">
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} placeholder="One line about what you make (optional)" className="max-w-md" />
            <Button onClick={() => become.mutate()} disabled={become.isPending}>{become.isPending && <Spinner />} Turn on creator tools</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 text-lg font-bold">Profile</h2>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input defaultValue={c.tagline} onBlur={(e) => e.target.value !== c.tagline && update.mutate({ tagline: e.target.value })} maxLength={140} placeholder="Tagline" className="max-w-md" />
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
                <span className="flex items-center gap-2 text-sm"><Heart className="size-4 text-pink-500" /> Accept tips</span>
                <Switch checked={c.tipsEnabled} onCheckedChange={(v) => update.mutate({ tipsEnabled: v })} />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
                <span className="text-sm">Creator tools on <span className="block text-xs text-muted-foreground">Turning off hides your memberships and tips (current members keep access until their month ends)</span></span>
                <Switch checked={c.isActive} onCheckedChange={(v) => update.mutate({ isActive: v })} />
              </label>
              <p className="text-sm">Identity check: <b className="capitalize">{c.kycStatus === "none" ? "not started" : c.kycStatus}</b> {c.kycStatus !== "verified" && <Link href="/wallet" className="text-primary hover:underline">— needed before your first payout</Link>}</p>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Membership tiers</h2>
              <Button size="sm" onClick={() => setTierDialog({ tier: null })}><Plus /> New tier</Button>
            </div>
            {me.data!.tiers.length === 0 && <p className="text-sm text-muted-foreground">No tiers yet. Create one so fans can become members.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {me.data!.tiers.map((t) => (
                <div key={t.id} className={`rounded-xl border p-4 ${t.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-sm tabular-nums">{formatMoney(t.priceMinor, t.currency)}/month · {t.memberCount ?? 0} member{t.memberCount === 1 ? "" : "s"}</p>
                    </div>
                    <button type="button" onClick={() => setTierDialog({ tier: t })} className="rounded-md p-1.5 hover:bg-accent" aria-label={`Edit ${t.name}`}><Pencil className="size-4" /></button>
                  </div>
                  {t.benefits.length > 0 && <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">{t.benefits.map((b) => <li key={b}>• {b}</li>)}</ul>}
                  <Button size="xs" variant="ghost" className="mt-2" onClick={() => toggleTier.mutate(t)}>{t.isActive ? "Hide tier" : "Show tier"}</Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Post members-only or paid content from the post composer (choose who can see it).</p>
          </section>
        </>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">Memberships you pay for</h2>
        {memberships.data?.memberships.length === 0 && <EmptyState title="No memberships">Support creators from their profile.</EmptyState>}
        <ul className="divide-y">
          {memberships.data?.memberships.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <UserAvatar src={m.creator.avatarUrl} name={m.creator.displayName} className="size-10" />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${m.creator.username}`} className="font-semibold hover:underline">{m.creator.displayName}</Link>
                <p className="text-sm text-muted-foreground">{m.tierName} · {formatMoney(m.priceMinor, m.currency)}/month · {m.status === "canceled" ? "ends" : "paid until"} {new Date(m.currentPeriodEnd).toLocaleDateString()}</p>
              </div>
              {m.status === "active" && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(m.creator.id)} disabled={cancel.isPending}><X /> Cancel renewal</Button>}
            </li>
          ))}
        </ul>
      </section>

      {tierDialog && <TierDialog key={tierDialog.tier?.id ?? "new"} tier={tierDialog.tier} open onOpenChange={(o) => !o && setTierDialog(null)} />}
    </div>
  );
}
