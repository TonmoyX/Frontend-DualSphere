"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Megaphone, MoreHorizontal, Pencil, Plus, Send, Sparkles, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common/bits";
import { type Business, BusinessLogo, type Campaign, CATEGORIES, fmtCost, fmtNum, fmtPct, type Metrics, MetricsChart, MetricTiles, OBJECTIVE_LABEL, PageBadgeIcon, type Range, RangePicker, StatusBadge, useMyBusinesses, VerificationBadge } from "@/components/ads/ads-bits";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { TopUpDialog } from "@/components/money/pay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

export default function AdsPage() {
  return <Suspense><AdsInner /></Suspense>;
}

function CreateBusiness({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [f, setF] = useState({ name: "", slug: "", category: "retail", website: "", description: "" });
  const create = useMutation({
    mutationFn: () => post<{ business: Business }>("/business", { name: f.name, slug: f.slug, category: f.category, description: f.description, ...(f.website ? { website: f.website } : {}) }),
    onSuccess: ({ business }) => { toast.success("Business page created"); qc.invalidateQueries({ queryKey: ["my-businesses"] }); onOpenChange(false); router.replace(`/ads?b=${business.id}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create a business page</DialogTitle><DialogDescription>Ads always run from a business page and show its name. DualSphere staff verify it before ads go live.</DialogDescription></DialogHeader>
        <div className="space-y-2.5">
          <div className="space-y-1"><Label htmlFor="b-name">Business name</Label><Input id="b-name" value={f.name} maxLength={60} onChange={(e) => setF((x) => ({ ...x, name: e.target.value, slug: x.slug || "" }))} /></div>
          <div className="space-y-1"><Label htmlFor="b-slug">Link</Label><Input id="b-slug" value={f.slug} maxLength={32} placeholder="my-shop" onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} /></div>
          <div className="space-y-1">
            <Label htmlFor="b-cat">Category</Label>
            <select id="b-cat" value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))} className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm capitalize">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " & ")}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label htmlFor="b-web">Website (https)</Label><Input id="b-web" value={f.website} placeholder="https://" onChange={(e) => setF((x) => ({ ...x, website: e.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="b-desc">About</Label><Textarea id="b-desc" value={f.description} maxLength={1000} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} className="min-h-16" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || f.name.trim().length < 2 || f.slug.length < 3}>{create.isPending && <Spinner />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdsInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/login?next=/ads"); }, [loading, user, router]);
  const { data, isLoading } = useMyBusinesses(!!user);
  const list = data?.businesses ?? [];
  const selected = list.find((b) => b.id === params.get("b")) ?? list[0];
  const verify = useMutation({
    mutationFn: () => post(`/business/${selected!.id}/verification`),
    onSuccess: () => { toast.success("Application sent — DualSphere will review your page"); qc.invalidateQueries({ queryKey: ["my-businesses"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const remove = useMutation({
    mutationFn: () => del(`/business/${selected!.id}`, { confirmName }),
    onSuccess: () => { toast.success("Business page deleted"); setDeleteOpen(false); setConfirmName(""); qc.invalidateQueries({ queryKey: ["my-businesses"] }); router.replace("/ads"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user || isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  const canEdit = selected && selected.role !== "analyst";
  const cur = selected?.currency ?? "USD";

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone className="size-6 text-primary" /> Ads Manager</h1>
        <Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus /> New business page</Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-8" />} title="Start advertising">Create a business page first — every ad runs under it. <button type="button" className="text-primary hover:underline" onClick={() => setCreateOpen(true)}>Create one</button></EmptyState>
      ) : (
        <>
          {list.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {list.map((b) => (
                <button key={b.id} type="button" onClick={() => router.replace(`/ads?b=${b.id}`)} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${b.id === selected?.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <BusinessLogo b={b} className="size-5 rounded-full text-[10px]" /> {b.name}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5">
              <BusinessLogo b={selected} className="size-14 text-xl" />
              <div className="min-w-0 flex-1">
                <Link href={`/business/${selected.slug}`} className="inline-flex items-center gap-1.5 text-lg font-bold hover:underline">{selected.name} <PageBadgeIcon badge={selected.badge} /></Link>
                <div className="flex flex-wrap items-center gap-2"><VerificationBadge v={selected.verification} />{selected.isSuspended && <StatusBadge status="rejected" />}</div>
                {selected.verification === "rejected" && selected.verificationNote && <p className="text-xs text-destructive">{selected.verificationNote}</p>}
                {selected.isSuspended && <p className="text-xs text-destructive">Suspended: {selected.suspendedReason}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase">Ad balance</p>
                <p className="text-xl font-bold tabular-nums">{formatMoney(selected.adBalanceMinor ?? 0, cur)}</p>
              </div>
              {canEdit && (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Button size="sm" variant="secondary" onClick={() => setTopUpOpen(true)}><Wallet /> Add funds</Button>
                  {(selected.verification === "unverified" || selected.verification === "rejected") && selected.role === "owner" && (
                    <Button size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}><Send /> Apply to run ads</Button>
                  )}
                  {selected.role === "owner" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete page</Button>
                  )}
                </div>
              )}
            </section>
          )}

          {selected && selected.verification !== "verified" && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {selected.verification === "pending"
                ? "Your page's application is being reviewed. You can create campaigns and add funds now — they start automatically once the page is approved."
                : "To run ads, apply with your business page. After DualSphere approves the page, every funded campaign runs right away — no approval per ad."}
            </p>
          )}

          {selected && <Manager business={selected} canEdit={!!canEdit} onTopUp={() => setTopUpOpen(true)} />}
        </>
      )}

      <CreateBusiness open={createOpen} onOpenChange={setCreateOpen} />
      <Dialog open={deleteOpen} onOpenChange={(o) => !remove.isPending && setDeleteOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selected?.name}?</DialogTitle>
            <DialogDescription>
              The page disappears and all its campaigns stop. {selected && (selected.adBalanceMinor ?? 0) > 0 ? `Its remaining ad balance (${formatMoney(selected.adBalanceMinor ?? 0, "USD")}) stays on record — contact support to get it refunded.` : ""} Type the business name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={selected?.name} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={remove.isPending}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending || confirmName.trim() !== selected?.name} onClick={() => remove.mutate()}>{remove.isPending && <Spinner />} Delete page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TopUpDialog business={topUpOpen && selected ? { id: selected.id, name: selected.name } : null} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}

type Row = Campaign & { adSets: number; ads: number; metrics: Metrics };
interface Insights { range: Range; totals: Metrics; series: (Metrics & { at: string })[]; balanceMinor: number; campaigns: Row[] }
interface Billing { balanceMinor: number; payments: { id: string; amountMinor: number; status: string; provider: string; createdAt: string }[]; dailySpend: { day: string; spendMinor: number }[] }

/** Results column: clicks for click objectives, reach for awareness, impressions otherwise (like Facebook's "Results"). */
function result(c: Row) {
  if (["traffic", "messages", "leads", "sales"].includes(c.objective)) return { n: c.metrics.clicks, label: "Link clicks" };
  if (c.objective === "awareness") return { n: c.metrics.reach, label: "Reach" };
  return { n: c.metrics.impressions, label: "Impressions" };
}

function Manager({ business, canEdit, onTopUp }: { business: Business; canEdit: boolean; onTopUp: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<"campaigns" | "billing">("campaigns");
  const [range, setRange] = useState<Range>("7d");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const insights = useQuery({ queryKey: ["ads-insights", business.id, range], queryFn: () => get<Insights>(`/ads/insights?businessId=${business.id}&range=${range}`), refetchInterval: 60_000 });
  const billing = useQuery({ queryKey: ["ads-billing", business.id], queryFn: () => get<Billing>(`/ads/billing?businessId=${business.id}`), enabled: tab === "billing" && business.role !== "analyst" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ads-insights", business.id] }); qc.invalidateQueries({ queryKey: ["my-businesses"] }); };
  const toggle = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "submit" }) => post(`/ads/campaigns/${id}/status`, { action }),
    onSuccess: (_r, v) => { toast.success(v.action === "pause" ? "Campaign turned off" : "Campaign turned on"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => post<{ campaign: { id: string } }>(`/ads/campaigns/${id}/duplicate`),
    onSuccess: ({ campaign }) => { toast.success("Copied as a draft"); refresh(); router.push(`/ads/${campaign.id}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del<{ deleted: boolean; archived: boolean }>(`/ads/campaigns/${id}`),
    onSuccess: (r) => { toast.success(r.deleted ? "Campaign deleted" : "Campaign ended and archived — its results stay in your reports"); setDeleting(null); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = insights.data?.campaigns ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border bg-card p-0.5 text-sm font-medium">
          {(["campaigns", "billing"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1 capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
        {tab === "campaigns" && (
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={setRange} />
            {canEdit && <Button size="sm" variant="secondary" asChild><Link href={`/ads/studio?b=${business.id}`}><Sparkles /> AI Ad Studio</Link></Button>}
            {canEdit && <Button size="sm" asChild><Link href={`/ads/new?b=${business.id}`}><Plus /> Create</Link></Button>}
          </div>
        )}
      </div>

      {tab === "campaigns" && (
        <>
          {insights.data && <MetricTiles m={insights.data.totals} />}
          {insights.data && <MetricsChart series={insights.data.series} hourly={range === "today"} />}
          <div className="overflow-x-auto rounded-2xl border bg-card">
            {insights.isLoading && <Spinner className="m-6 size-5" />}
            {insights.data && rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">No campaigns yet. {canEdit && <Link href={`/ads/new?b=${business.id}`} className="text-primary hover:underline">Create your first campaign</Link>}</p>}
            {rows.length > 0 && (
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th className="w-14 text-left">Off/On</th><th className="text-left">Campaign</th><th className="text-left">Budget</th><th>Results</th><th>Reach</th><th>Impressions</th><th>CTR</th><th>CPC</th><th>Amount spent</th><th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((c) => {
                    const r = result(c);
                    const on = c.status === "active";
                    const canToggle = canEdit && !c.staffPaused && (c.status === "active" || c.status === "paused" || c.status === "pending_review");
                    return (
                      <tr key={c.id} className="text-right tabular-nums hover:bg-accent/30 [&>td]:px-3 [&>td]:py-2.5">
                        <td className="text-left">
                          {c.status === "draft" ? (
                            canEdit && <Button size="xs" onClick={() => toggle.mutate({ id: c.id, action: "submit" })}>Publish</Button>
                          ) : (
                            <Switch checked={on || c.status === "pending_review"} disabled={!canToggle || toggle.isPending}
                              onCheckedChange={(v) => toggle.mutate({ id: c.id, action: v ? "resume" : "pause" })} aria-label={on ? "Turn off" : "Turn on"} />
                          )}
                        </td>
                        <td className="max-w-72 text-left">
                          <Link href={`/ads/${c.id}`} className="block truncate font-medium text-primary hover:underline">{c.name}</Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <StatusBadge status={c.status} /> {OBJECTIVE_LABEL[c.objective] ?? c.objective} · {c.adSets} ad set{c.adSets === 1 ? "" : "s"} · {c.ads} ad{c.ads === 1 ? "" : "s"}
                          </div>
                          {c.pauseReason && c.status !== "active" && <p className={`truncate text-xs ${c.staffPaused ? "text-destructive" : "text-muted-foreground"}`}>{c.pauseReason}</p>}
                        </td>
                        <td className="text-left text-xs">{formatMoney(c.dailyBudgetMinor, c.currency)}<span className="text-muted-foreground">/day</span>{c.totalBudgetMinor ? <span className="block text-muted-foreground">{formatMoney(c.totalBudgetMinor, c.currency)} total</span> : null}</td>
                        <td><span className="font-semibold">{fmtNum(r.n)}</span><span className="block text-[11px] text-muted-foreground">{r.label}</span></td>
                        <td>{fmtNum(c.metrics.reach)}</td>
                        <td>{fmtNum(c.metrics.impressions)}</td>
                        <td>{fmtPct(c.metrics.ctr)}</td>
                        <td>{fmtCost(c.metrics.cpcMinor)}</td>
                        <td className="font-semibold">${(c.metrics.spendMinor / 100).toFixed(2)}</td>
                        <td>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Campaign options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/ads/${c.id}`}><Pencil /> Edit &amp; results</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicate.mutate(c.id)}><Copy /> Duplicate</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}><Trash2 /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Reach is estimated (people are counted per day, never identified). Numbers update every few minutes.</p>
        </>
      )}

      {tab === "billing" && (
        business.role === "analyst" ? <p className="text-sm text-muted-foreground">Only page owners and admins can see billing.</p> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-xs text-muted-foreground uppercase">Prepaid ad balance</p>
              <p className="text-3xl font-bold tabular-nums">{formatMoney(billing.data?.balanceMinor ?? business.adBalanceMinor ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Ads stop automatically when the balance runs out. You&apos;re charged only for real views or clicks, never more than your budgets.</p>
              {canEdit && <Button onClick={onTopUp}><Wallet /> Add funds</Button>}
              <h3 className="pt-2 text-sm font-semibold">Payments</h3>
              {billing.isLoading && <Spinner className="size-4" />}
              {billing.data?.payments.length === 0 && <p className="text-xs text-muted-foreground">No payments yet.</p>}
              <div className="divide-y text-sm">
                {billing.data?.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2">
                    <span>{new Date(p.createdAt).toLocaleDateString()} · <span className="capitalize">{p.provider}</span></span>
                    <span className="flex items-center gap-2"><StatusBadge status={p.status === "succeeded" ? "approved" : p.status === "refunded" ? "completed" : "draft"} /><span className="font-semibold tabular-nums">{formatMoney(p.amountMinor)}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold">Daily spend (last 30 days)</h3>
              {billing.data?.dailySpend.length === 0 && <p className="text-xs text-muted-foreground">No spend yet.</p>}
              <div className="divide-y text-sm">
                {billing.data?.dailySpend.map((d) => (
                  <div key={d.day} className="flex justify-between py-1.5 tabular-nums"><span>{d.day}</span><span>${(d.spendMinor / 100).toFixed(2)}</span></div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              {deleting && (deleting.spentMinor > 0 || deleting.metrics.impressions > 0)
                ? "This campaign has already run, so it will be ended and archived — its results stay in your reports and billing."
                : "The campaign, its ad sets and ads will be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={remove.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate(deleting!.id)} disabled={remove.isPending}>{remove.isPending && <Spinner />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
