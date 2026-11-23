"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, Copy, ImagePlus, MoreHorizontal, Pencil, Plus, ShieldAlert, Sparkles, Square, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common/bits";
import {
  AdPreview, type AdSet, Breakdown, BusinessLogo, type Campaign, type Creative, CTA_LABEL, fmtCost, fmtNum, fmtPct, type Metrics, MetricsChart, MetricTiles,
  OBJECTIVE_LABEL, type Placement, PLACEMENT_LABEL, type Range, RangePicker, StatusBadge, targetingSummary, useAudienceEstimate, VerificationBadge,
} from "@/components/ads/ads-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, patch, post } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { cn, formatMoney, toMinor } from "@/lib/utils";

interface Detail {
  campaign: Campaign & { impressions: number; clicks: number; ctr: number; cpcMinor: number | null };
  business: { id: string; name: string; slug: string; logoUrl: string | null; verification: "unverified" | "pending" | "verified" | "rejected"; role: string };
  adSets: AdSet[];
  creatives: Creative[];
}
interface Insights {
  totals: Metrics; series: (Metrics & { at: string })[];
  breakdowns: { age: (Metrics & { key: string })[]; gender: (Metrics & { key: string })[]; placement: (Metrics & { key: string })[] };
  byCreative: Record<string, Metrics>; byAdSet: Record<string, Metrics>;
}
const EMPTY: Metrics = { impressions: 0, reach: 0, clicks: 0, spendMinor: 0, ctr: 0, cpcMinor: null, cpmMinor: null, frequency: 0 };
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const localInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

function MiniMetrics({ m }: { m: Metrics }) {
  return (
    <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
      <span>{fmtNum(m.impressions)} impressions</span><span>{fmtNum(m.reach)} reach</span><span>{fmtNum(m.clicks)} clicks</span>
      <span>{fmtPct(m.ctr)} CTR</span><span>{fmtCost(m.cpcMinor)} CPC</span><span className="font-medium text-foreground">${(m.spendMinor / 100).toFixed(2)} spent</span>
    </span>
  );
}

// ── Edit campaign ──
function CampaignDialog({ c, onClose, onSaved }: { c: Campaign; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: c.name, daily: String(c.dailyBudgetMinor / 100), total: c.totalBudgetMinor ? String(c.totalBudgetMinor / 100) : "", startsAt: localInput(c.startsAt), endsAt: localInput(c.endsAt) });
  const save = useMutation({
    mutationFn: () => patch(`/ads/campaigns/${c.id}`, {
      name: f.name, dailyBudgetMinor: toMinor(f.daily), totalBudgetMinor: f.total ? toMinor(f.total) : null,
      ...(f.startsAt ? { startsAt: new Date(f.startsAt).toISOString() } : {}), endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    }),
    onSuccess: () => { toast.success("Campaign updated"); onSaved(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit campaign</DialogTitle><DialogDescription>Changes apply straight away.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="e-name">Name</Label><Input id="e-name" value={f.name} maxLength={80} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="e-daily">Daily budget ($)</Label><Input id="e-daily" inputMode="decimal" value={f.daily} onChange={(e) => setF((x) => ({ ...x, daily: e.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="e-total">Total limit ($, optional)</Label><Input id="e-total" inputMode="decimal" value={f.total} onChange={(e) => setF((x) => ({ ...x, total: e.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="e-start">Start</Label><Input id="e-start" type="datetime-local" value={f.startsAt} onChange={(e) => setF((x) => ({ ...x, startsAt: e.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="e-end">End (optional)</Label><Input id="e-end" type="datetime-local" value={f.endsAt} onChange={(e) => setF((x) => ({ ...x, endsAt: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || f.name.trim().length < 2 || !Number.isFinite(toMinor(f.daily))}>{save.isPending && <Spinner />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ad set: create / edit ──
function AdSetDialog({ campaignId, set, onClose, onSaved }: { campaignId: string; set: AdSet | null; onClose: () => void; onSaved: () => void }) {
  const t = set?.targeting ?? {};
  const [s, setS] = useState({
    name: set?.name ?? "New ad set", geo: (t.geo ?? []).join(", "), ageMin: String(t.ageMin ?? 18), ageMax: String(t.ageMax ?? 65),
    gender: (t.genders?.length === 1 ? t.genders[0] : "all") as "all" | "male" | "female", interests: (t.interests ?? []).join(", "),
    placements: set?.placements ?? (["feed", "sidebar", "reels"] as Placement[]), billingEvent: set?.billingEvent ?? "impression",
    bidStrategy: set?.bidStrategy ?? "lowest_cost", bid: set ? String(((set.billingEvent === "click" ? set.bidCpcMinor : set.bidCpmMinor) ?? 0) / 100) : "", frequencyCap: String(set?.frequencyCap ?? 3),
  });
  const targeting = { geo: list(s.geo), ageMin: Number(s.ageMin) || 18, ageMax: Number(s.ageMax) || 65, interests: list(s.interests), genders: s.gender === "all" ? [] : [s.gender] };
  const estimate = useAudienceEstimate(targeting as never);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: s.name, targeting, placements: s.placements, billingEvent: s.billingEvent, bidStrategy: s.bidStrategy, frequencyCap: Number(s.frequencyCap) || 3,
        ...(s.bidStrategy === "bid_cap" ? (s.billingEvent === "click" ? { bidCpcMinor: toMinor(s.bid) } : { bidCpmMinor: toMinor(s.bid) }) : {}),
      };
      return set ? patch(`/ads/adsets/${set.id}`, body) : post(`/ads/campaigns/${campaignId}/adsets`, body);
    },
    onSuccess: () => { toast.success(set ? "Ad set updated" : "Ad set added — now add ads to it"); onSaved(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{set ? "Edit ad set" : "New ad set"}</DialogTitle><DialogDescription>Who sees your ads, where, and how you pay.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input value={s.name} maxLength={80} onChange={(e) => setS((x) => ({ ...x, name: e.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Locations (empty = everywhere)</Label><Input value={s.geo} placeholder="Dhaka, Sylhet" onChange={(e) => setS((x) => ({ ...x, geo: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Age from</Label><Input inputMode="numeric" value={s.ageMin} onChange={(e) => setS((x) => ({ ...x, ageMin: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Age to</Label><Input inputMode="numeric" value={s.ageMax} onChange={(e) => setS((x) => ({ ...x, ageMax: e.target.value }))} /></div>
          <div className="flex gap-1.5 sm:col-span-2">
            {(["all", "male", "female"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setS((x) => ({ ...x, gender: g }))} className={cn("rounded-full border px-3 py-1 text-sm", s.gender === g ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{g === "all" ? "All genders" : g === "male" ? "Men" : "Women"}</button>
            ))}
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>Interests</Label><Input value={s.interests} placeholder="football, music" onChange={(e) => setS((x) => ({ ...x, interests: e.target.value }))} /></div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2"><Users className="size-3.5" /> {estimate.data?.label ?? (estimate.data ? `${estimate.data.lower?.toLocaleString()} – ${estimate.data.upper.toLocaleString()} people` : "…")}</p>
          <div className="space-y-1 sm:col-span-2">
            <Label>Placements</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((p) => {
                const on = s.placements.includes(p);
                return <button key={p} type="button" onClick={() => setS((x) => ({ ...x, placements: on ? x.placements.filter((y) => y !== p) : [...x.placements, p] }))} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{on && <Check className="size-3.5" />}{PLACEMENT_LABEL[p]}</button>;
              })}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Charged per</Label>
            <select value={s.billingEvent} onChange={(e) => setS((x) => ({ ...x, billingEvent: e.target.value as "impression" | "click" }))} className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm">
              <option value="impression">1,000 impressions</option><option value="click">Link click</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Bid strategy</Label>
            <select value={s.bidStrategy} onChange={(e) => setS((x) => ({ ...x, bidStrategy: e.target.value as "lowest_cost" | "bid_cap" }))} className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm">
              <option value="lowest_cost">Lowest cost (standard price)</option><option value="bid_cap">Bid cap</option>
            </select>
          </div>
          {s.bidStrategy === "bid_cap" && <div className="space-y-1"><Label>{s.billingEvent === "click" ? "Price per click ($)" : "Price per 1,000 views ($)"}</Label><Input inputMode="decimal" value={s.bid} onChange={(e) => setS((x) => ({ ...x, bid: e.target.value }))} /></div>}
          <div className="space-y-1"><Label>Frequency cap / person / day</Label><Input inputMode="numeric" value={s.frequencyCap} onChange={(e) => setS((x) => ({ ...x, frequencyCap: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !s.placements.length}>{save.isPending && <Spinner />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ad: create / edit ──
type MediaItem = { id: string; url?: string; preview?: string; type: string };
function CreativeDialog({ adSetId, creative, business, onClose, onSaved }: { adSetId: string; creative: Creative | null; business: { name: string; logoUrl: string | null }; onClose: () => void; onSaved: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ headline: creative?.headline ?? "", body: creative?.body ?? "", cta: creative?.cta ?? "learn_more", linkUrl: creative?.linkUrl ?? "", claimsConfirmed: creative?.claimsConfirmed ?? false });
  const [media, setMedia] = useState<MediaItem[]>(creative?.media ?? []);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const done = await Promise.all(Array.from(files).slice(0, 5 - media.length).map(async (fl) => { const m = await uploadMedia(fl, "ad"); return { id: m.id, preview: URL.createObjectURL(fl), type: fl.type.startsWith("video/") ? "video" : "image" }; }));
      setMedia((cur) => [...cur, ...done]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { headline: f.headline, body: f.body, cta: f.cta, linkUrl: f.linkUrl || null, mediaIds: media.map((m) => m.id), claimsConfirmed: f.claimsConfirmed };
      return creative ? patch(`/ads/creatives/${creative.id}`, body) : post(`/ads/adsets/${adSetId}/creatives`, { creatives: [body] });
    },
    onSuccess: () => { toast.success(creative ? "Ad updated" : "Ad added"); onSaved(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{creative ? "Edit ad" : "New ad"}</DialogTitle><DialogDescription>Ads that break the advertising policy are refused automatically.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1"><Label>Primary text</Label><Textarea value={f.body} maxLength={600} className="min-h-24" onChange={(e) => setF((x) => ({ ...x, body: e.target.value }))} /></div>
            <div className="flex flex-wrap gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative size-16 overflow-hidden rounded-lg border">
                  {m.type === "video" ? <video src={m.preview ?? m.url} className="size-full object-cover" muted /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.preview ?? m.url} alt="" className="size-full object-cover" />
                  )}
                  <button type="button" onClick={() => setMedia((cur) => cur.filter((x) => x.id !== m.id))} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove file"><X className="size-3" /></button>
                </div>
              ))}
              {media.length < 5 && <button type="button" onClick={() => file.current?.click()} className="grid size-16 place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-accent" aria-label="Add photo or video">{uploading ? <Spinner /> : <ImagePlus className="size-5" />}</button>}
              <input ref={file} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </div>
            <div className="space-y-1"><Label>Headline</Label><Input value={f.headline} maxLength={90} onChange={(e) => setF((x) => ({ ...x, headline: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Website URL</Label><Input value={f.linkUrl} placeholder="https://" onChange={(e) => setF((x) => ({ ...x, linkUrl: e.target.value.trim() }))} /></div>
            <div className="space-y-1">
              <Label>Call to action</Label>
              <select value={f.cta} onChange={(e) => setF((x) => ({ ...x, cta: e.target.value }))} className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm">
                {Object.entries(CTA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <AdPreview business={business} ad={{ ...f, media }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || uploading || !f.headline.trim() || (!!f.linkUrl && !f.linkUrl.startsWith("https://"))}>{save.isPending && <Spinner />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const [range, setRange] = useState<Range>("7d");
  const [editCampaign, setEditCampaign] = useState(false);
  const [setDialog, setSetDialog] = useState<{ set: AdSet | null } | null>(null);
  const [adDialog, setAdDialog] = useState<{ adSetId: string; creative: Creative | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["campaign", campaignId], queryFn: () => get<Detail>(`/ads/campaigns/${campaignId}`), refetchInterval: 60_000 });
  const insights = useQuery({ queryKey: ["campaign-insights", campaignId, range], queryFn: () => get<Insights>(`/ads/campaigns/${campaignId}/insights?range=${range}`), refetchInterval: 60_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["campaign", campaignId] }); qc.invalidateQueries({ queryKey: ["campaign-insights", campaignId] }); qc.invalidateQueries({ queryKey: ["ads-insights"] }); };
  const act = useMutation({
    mutationFn: ({ url, method = "post", body }: { url: string; method?: "post" | "del"; body?: unknown }) => (method === "del" ? del(url) : post(url, body)),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const duplicate = useMutation({
    mutationFn: () => post<{ campaign: { id: string } }>(`/ads/campaigns/${campaignId}/duplicate`),
    onSuccess: ({ campaign }) => { toast.success("Copied as a draft"); router.push(`/ads/${campaign.id}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del<{ deleted: boolean }>(`/ads/campaigns/${campaignId}`),
    onSuccess: (r) => { toast.success(r.deleted ? "Campaign deleted" : "Campaign ended and archived"); router.push(`/ads?b=${data?.business.id ?? ""}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  if (error || !data) return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Campaign not found" /></div>;
  const c = data.campaign;
  const canEdit = data.business.role !== "analyst";
  const ended = c.status === "completed" || !!c.archivedAt;
  const ins = insights.data;
  const status = (action: "pause" | "resume" | "submit" | "end") => act.mutate({ url: `/ads/campaigns/${campaignId}/status`, body: { action } });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BusinessLogo b={data.business} className="size-11" />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">{c.name} <StatusBadge status={c.status} /></h1>
            <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">{data.business.name} · {OBJECTIVE_LABEL[c.objective] ?? c.objective} · <VerificationBadge v={data.business.verification} /></p>
          </div>
        </div>
        <Button variant="secondary" size="sm" asChild><Link href={`/ads?b=${data.business.id}`}><ArrowLeft /> Ads Manager</Link></Button>
      </div>

      {c.pauseReason && c.status === "paused" && <p className={cn("rounded-lg px-3 py-2 text-sm", c.staffPaused ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>{c.pauseReason}</p>}
      {c.status === "pending_review" && <p className="rounded-lg bg-muted px-3 py-2 text-sm">This campaign starts automatically as soon as your business page is approved to run ads. <Link href={`/ads?b=${data.business.id}`} className="text-primary hover:underline">Apply from Ads Manager</Link></p>}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
          {c.status === "draft" || c.status === "rejected" ? <Button size="sm" onClick={() => status("submit")}>Publish</Button> : !ended && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={c.status === "active" || c.status === "pending_review"} disabled={c.staffPaused || act.isPending} onCheckedChange={(v) => status(v ? "resume" : "pause")} />
              {c.status === "active" ? "On" : c.status === "pending_review" ? "On (waiting)" : "Off"}
            </label>
          )}
          <span className="text-sm text-muted-foreground">
            {formatMoney(c.dailyBudgetMinor, c.currency)}/day · today {formatMoney(c.todaySpentMinor, c.currency)}{c.totalBudgetMinor != null ? ` · limit ${formatMoney(c.totalBudgetMinor, c.currency)}` : ""} · spent {formatMoney(c.spentMinor, c.currency)}
            {c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString()}` : ""}
          </span>
          <div className="ml-auto flex gap-1.5">
            {!ended && <Button size="sm" variant="secondary" onClick={() => setEditCampaign(true)}><Pencil /> Edit</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => duplicate.mutate()}><Copy /> Duplicate</DropdownMenuItem>
                {!ended && <DropdownMenuItem onClick={() => status("end")}><Square /> End campaign</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Results</h2>
        <RangePicker value={range} onChange={setRange} />
      </div>
      {ins ? (
        <>
          <MetricTiles m={ins.totals} />
          <MetricsChart series={ins.series} hourly={range === "today"} />
          <div className="grid gap-3 md:grid-cols-3">
            <Breakdown title="By age" rows={ins.breakdowns.age} />
            <Breakdown title="By gender" rows={ins.breakdowns.gender} />
            <Breakdown title="By placement" rows={ins.breakdowns.placement} labels={PLACEMENT_LABEL} />
          </div>
        </>
      ) : <Spinner className="size-5" />}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h2 className="font-bold">Ad sets &amp; ads</h2>
        {canEdit && !ended && <Button size="sm" variant="secondary" onClick={() => setSetDialog({ set: null })}><Plus /> New ad set</Button>}
      </div>
      {data.adSets.map((s) => {
        const ads = data.creatives.filter((cr) => cr.adSetId === s.id);
        return (
          <section key={s.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              {canEdit && !ended && <Switch checked={s.status === "active"} onCheckedChange={(v) => act.mutate({ url: `/ads/adsets/${s.id}/status`, body: { action: v ? "resume" : "pause" } })} aria-label="Ad set on/off" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name} {s.status === "paused" && <StatusBadge status="paused" />}</p>
                <p className="text-xs text-muted-foreground">{targetingSummary(s.targeting)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.placements.map((p) => PLACEMENT_LABEL[p]).join(", ")} · {s.billingEvent === "click" ? `per click ${formatMoney(s.bidCpcMinor ?? 20)}` : `${formatMoney(s.bidCpmMinor)} per 1,000 views`} ({s.bidStrategy === "bid_cap" ? "bid cap" : "lowest cost"}) · max {s.frequencyCap}/person/day
                </p>
                <div className="mt-1"><MiniMetrics m={ins?.byAdSet[s.id] ?? EMPTY} /></div>
              </div>
              {canEdit && !ended && (
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setSetDialog({ set: s })}><Pencil /> Edit</Button>
                  {data.adSets.length > 1 && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => act.mutate({ url: `/ads/adsets/${s.id}`, method: "del" })} aria-label="Delete ad set"><Trash2 /></Button>}
                </div>
              )}
            </div>
            <div className="divide-y rounded-xl border">
              {ads.map((cr) => {
                const m = cr.media[0];
                return (
                  <div key={cr.id} className="flex flex-wrap items-center gap-3 p-3">
                    {canEdit && !ended && (cr.status === "approved" || cr.status === "paused") && (
                      <Switch checked={cr.status === "approved"} onCheckedChange={(v) => act.mutate({ url: `/ads/creatives/${cr.id}/status`, body: { action: v ? "resume" : "pause" } })} aria-label="Ad on/off" />
                    )}
                    {m ? (m.type === "video" ? <video src={m.url} className="size-14 rounded-lg object-cover" muted /> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="size-14 rounded-lg object-cover" />
                    )) : <span className="grid size-14 place-items-center rounded-lg bg-muted text-xs text-muted-foreground">{cr.label}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        <span className="rounded bg-muted px-1 font-mono text-[11px]">{cr.label}</span> <span className="truncate">{cr.headline}</span> <StatusBadge status={cr.status} />
                        {cr.source === "ai" && <span className="inline-flex items-center gap-1 text-xs text-primary"><Sparkles className="size-3" /> AI</span>}
                      </p>
                      <MiniMetrics m={ins?.byCreative[cr.id] ?? EMPTY} />
                      {cr.reviewReason && <p className="text-xs text-muted-foreground">{cr.reviewReason}</p>}
                      {cr.status === "rejected" && <p className="flex items-center gap-1 text-xs text-destructive"><ShieldAlert className="size-3.5" /> Taken down by DualSphere staff</p>}
                      {cr.claimsToVerify.length > 0 && (
                        <p className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Claims: {cr.claimsToVerify.join(", ")}</span>
                          {cr.claimsConfirmed ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3.5" /> confirmed</span>
                            : canEdit && <Button size="xs" variant="secondary" onClick={() => act.mutate({ url: `/ads/creatives/${cr.id}/confirm-claims` })}>I confirm these are true</Button>}
                        </p>
                      )}
                    </div>
                    {canEdit && !ended && cr.status !== "rejected" && (
                      <div className="flex gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setAdDialog({ adSetId: s.id, creative: cr })}><Pencil /> Edit</Button>
                        {cr.impressions === 0 && data.creatives.length > 1 && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => act.mutate({ url: `/ads/creatives/${cr.id}`, method: "del" })} aria-label="Delete ad"><Trash2 /></Button>}
                      </div>
                    )}
                  </div>
                );
              })}
              {ads.length === 0 && <p className="p-3 text-sm text-muted-foreground">No ads in this ad set yet.</p>}
            </div>
            {canEdit && !ended && <Button size="sm" variant="ghost" onClick={() => setAdDialog({ adSetId: s.id, creative: null })}><Plus /> Add ad</Button>}
          </section>
        );
      })}

      {editCampaign && <CampaignDialog c={c} onClose={() => setEditCampaign(false)} onSaved={refresh} />}
      {setDialog && <AdSetDialog campaignId={campaignId} set={setDialog.set} onClose={() => setSetDialog(null)} onSaved={refresh} />}
      {adDialog && <CreativeDialog adSetId={adDialog.adSetId} creative={adDialog.creative} business={data.business} onClose={() => setAdDialog(null)} onSaved={refresh} />}
      <Dialog open={confirmDelete} onOpenChange={(o) => !remove.isPending && setConfirmDelete(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{c.name}”?</DialogTitle>
            <DialogDescription>{c.spentMinor > 0 || c.impressions > 0 ? "It has already run, so it will be ended and archived — its results stay in your reports and billing." : "The campaign, its ad sets and ads will be deleted."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending && <Spinner />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
