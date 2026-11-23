"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BadgeCheck, Clock, Eye, Handshake, Heart, MessageCircle, MousePointerClick, ShieldAlert, ShieldCheck, ShoppingBag, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Business {
  id: string; slug: string; name: string; description: string; category: string; website: string | null; logoUrl: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected"; badge?: PageBadge; verificationNote?: string | null; isSuspended: boolean; suspendedReason?: string | null;
  role: "owner" | "admin" | "analyst" | null; adBalanceMinor?: number; currency?: Currency | null;
  members?: { id: string; username: string; displayName: string; avatarUrl: string | null; role: string }[];
}
export type PageBadge = "none" | "verified" | "official" | "partner" | "trusted";

/** Badge set by DualSphere staff on a business page. */
export function PageBadgeIcon({ badge, withLabel = false, className }: { badge?: PageBadge | null; withLabel?: boolean; className?: string }) {
  if (!badge || badge === "none") return null;
  const meta = {
    verified: { Icon: BadgeCheck, cls: "text-sky-500", label: "Verified" },
    official: { Icon: Award, cls: "text-amber-500", label: "Official" },
    partner: { Icon: Handshake, cls: "text-violet-500", label: "Partner" },
    trusted: { Icon: ShieldCheck, cls: "text-emerald-500", label: "Trusted" },
  }[badge];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", meta.cls, className)} title={`${meta.label} business`}>
      <meta.Icon className="size-4" />{withLabel && meta.label}
    </span>
  );
}

export interface Campaign {
  id: string; businessId: string; name: string; objective: Objective; archivedAt?: string | null; staffPaused?: boolean;
  status: "draft" | "pending_review" | "active" | "paused" | "rejected" | "completed"; currency: Currency;
  dailyBudgetMinor: number; totalBudgetMinor: number | null; spentMinor: number; todaySpentMinor: number;
  startsAt: string; endsAt: string | null; pauseReason: string | null; createdAt: string; impressions?: number; clicks?: number; ctr?: number; cpcMinor?: number | null;
}
export interface Creative {
  id: string; adSetId?: string; label: string; headline: string; body: string; cta: string; linkUrl: string | null; media: { id: string; url: string; type: string }[]; hashtags: string[];
  source: "manual" | "ai"; status: "pending_review" | "approved" | "rejected" | "paused"; reviewReason: string | null; policyFlags: string[];
  claimsToVerify: string[]; claimsConfirmed: boolean; impressions: number; clicks: number; ctr: number;
}

export const CTA_LABEL: Record<string, string> = { learn_more: "Learn more", shop_now: "Shop now", message: "Send message", sign_up: "Sign up", book_now: "Book now" };
export const OBJECTIVE_LABEL: Record<string, string> = { awareness: "Awareness", traffic: "Traffic", engagement: "Engagement", messages: "Messages", leads: "Leads", sales: "Sales" };
export const CATEGORIES = ["retail", "food", "fashion", "electronics", "education", "services", "health_beauty", "travel", "real_estate", "entertainment", "nonprofit", "other"] as const;

export function useMyBusinesses(enabled = true) {
  return useQuery({ queryKey: ["my-businesses"], queryFn: () => get<{ businesses: (Business & { adBalanceMinor: number })[] }>("/business"), enabled });
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    pending_review: "bg-amber-500/15 text-amber-700 dark:text-amber-400", paused: "bg-muted text-muted-foreground", draft: "bg-muted text-muted-foreground",
    rejected: "bg-destructive/15 text-destructive", completed: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  };
  const label: Record<string, string> = { pending_review: "Waiting for page approval" };
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>{label[status] ?? status.replace("_", " ")}</span>;
}

export function VerificationBadge({ v }: { v: Business["verification"] }) {
  if (v === "verified") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><BadgeCheck className="size-3.5" /> Approved to run ads</span>;
  if (v === "pending") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Clock className="size-3.5" /> Application under review</span>;
  if (v === "rejected") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><ShieldAlert className="size-3.5" /> Application not approved</span>;
  return <span className="text-xs text-muted-foreground">Not approved to run ads yet</span>;
}

export function BusinessLogo({ b, className }: { b: { name: string; logoUrl: string | null }; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted font-semibold", className ?? "size-10")}>
      {b.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logoUrl} alt="" className="size-full object-cover" />
      ) : b.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ── Ads Manager (Facebook-style) ──
export type Objective = "awareness" | "traffic" | "engagement" | "messages" | "leads" | "sales";
export type Placement = "feed" | "sidebar" | "reels";
export const OBJECTIVES: { v: Objective; label: string; desc: string; Icon: typeof Eye; billing: "impression" | "click" }[] = [
  { v: "awareness", label: "Awareness", desc: "Show your ad to as many people as possible", Icon: Eye, billing: "impression" },
  { v: "traffic", label: "Traffic", desc: "Send people to your website", Icon: MousePointerClick, billing: "click" },
  { v: "engagement", label: "Engagement", desc: "Get more reactions, comments and page visits", Icon: Heart, billing: "impression" },
  { v: "messages", label: "Messages", desc: "Get people to message your business", Icon: MessageCircle, billing: "click" },
  { v: "leads", label: "Leads", desc: "Collect sign-ups from interested people", Icon: UserPlus, billing: "click" },
  { v: "sales", label: "Sales", desc: "Find people likely to buy from you", Icon: ShoppingBag, billing: "click" },
];
export const PLACEMENT_LABEL: Record<Placement, string> = { feed: "Feed", sidebar: "Right column", reels: "Reels" };

export interface Targeting { geo?: string[]; ageMin?: number; ageMax?: number; interests?: string[]; genders?: ("male" | "female")[] }
export interface AdSet {
  id: string; name: string; status: "active" | "paused"; targeting: Targeting; placements: Placement[];
  billingEvent: "impression" | "click"; bidStrategy: "lowest_cost" | "bid_cap"; bidCpmMinor: number; bidCpcMinor: number | null; frequencyCap: number;
}
export interface Metrics { impressions: number; reach: number; clicks: number; spendMinor: number; ctr: number; cpcMinor: number | null; cpmMinor: number | null; frequency: number }
export type Range = "today" | "7d" | "30d" | "lifetime";
export const RANGE_LABEL: Record<Range, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", lifetime: "Lifetime" };

export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;
export const fmtCost = (minor: number | null) => (minor == null ? "—" : `$${(minor / 100).toFixed(minor < 100 ? 3 : 2)}`);

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex rounded-lg border bg-card p-0.5 text-xs font-medium">
      {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)} className={cn("rounded-md px-2.5 py-1", value === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{RANGE_LABEL[r]}</button>
      ))}
    </div>
  );
}

/** KPI tiles: results at a glance. */
export function MetricTiles({ m }: { m: Metrics }) {
  const tiles = [
    { label: "Amount spent", value: `$${(m.spendMinor / 100).toFixed(2)}` },
    { label: "Reach", value: fmtNum(m.reach), hint: "People who saw it (estimated)" },
    { label: "Impressions", value: fmtNum(m.impressions) },
    { label: "Frequency", value: m.frequency ? m.frequency.toFixed(2) : "—" },
    { label: "Link clicks", value: fmtNum(m.clicks) },
    { label: "CTR", value: fmtPct(m.ctr) },
    { label: "CPC", value: fmtCost(m.cpcMinor), hint: "Cost per click" },
    { label: "CPM", value: fmtCost(m.cpmMinor), hint: "Cost per 1,000 impressions" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card px-3 py-2.5" title={t.hint}>
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className="text-lg font-bold tabular-nums">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

type SeriesPoint = Metrics & { at: string };
const CHART_METRICS = { impressions: "Impressions", reach: "Reach", clicks: "Clicks", spendMinor: "Spend" } as const;

/** Bar chart of one metric over time (hourly for Today, daily otherwise). */
export function MetricsChart({ series, hourly }: { series: SeriesPoint[]; hourly?: boolean }) {
  const [key, setKey] = useState<keyof typeof CHART_METRICS>("impressions");
  const values = series.map((p) => Number(p[key]) || 0);
  const max = Math.max(1, ...values);
  const label = (at: string) => { const d = new Date(at); return hourly ? `${d.getHours()}:00` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const show = (v: number) => (key === "spendMinor" ? `$${(v / 100).toFixed(2)}` : fmtNum(v));
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Performance</p>
        <div className="flex gap-1 text-xs">
          {(Object.keys(CHART_METRICS) as (keyof typeof CHART_METRICS)[]).map((k) => (
            <button key={k} type="button" onClick={() => setKey(k)} className={cn("rounded-full border px-2.5 py-0.5", key === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>{CHART_METRICS[k]}</button>
          ))}
        </div>
      </div>
      {series.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p> : (
        <>
          <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`${CHART_METRICS[key]} over time`}>
            {series.map((p, i) => (
              <div key={p.at} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t bg-primary/70 transition group-hover:bg-primary" style={{ height: `${Math.max(values[i]! > 0 ? 3 : 0, (values[i]! / max) * 100)}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow group-hover:block">
                  {label(p.at)} · {show(values[i]!)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{label(series[0]!.at)}</span><span>{label(series[series.length - 1]!.at)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Breakdown table (age, gender, placement). */
export function Breakdown({ title, rows, labels }: { title: string; rows: (Metrics & { key: string })[]; labels?: Record<string, string> }) {
  const total = rows.reduce((a, r) => a + r.impressions, 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.key} className="text-xs">
              <div className="flex justify-between"><span className="capitalize">{labels?.[r.key] ?? r.key}</span><span className="tabular-nums text-muted-foreground">{fmtNum(r.impressions)} · {fmtNum(r.clicks)} clicks · ${(r.spendMinor / 100).toFixed(2)}</span></div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.impressions / total) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function targetingSummary(t: Targeting) {
  const parts = [`Age ${t.ageMin ?? 18}–${t.ageMax ?? 65}`];
  parts.push(t.genders?.length === 1 ? (t.genders[0] === "male" ? "Men" : "Women") : "All genders");
  parts.push(t.geo?.length ? t.geo.join(", ") : "All locations");
  if (t.interests?.length) parts.push(`Interests: ${t.interests.join(", ")}`);
  return parts.join(" · ");
}

/** Estimated audience size for a targeting (debounced). */
export function useAudienceEstimate(t: Targeting) {
  const key = JSON.stringify(t);
  const [debounced, setDebounced] = useState(key);
  useEffect(() => { const id = setTimeout(() => setDebounced(key), 500); return () => clearTimeout(id); }, [key]);
  return useQuery({
    queryKey: ["audience-estimate", debounced],
    queryFn: () => post<{ lower: number | null; upper: number; label: string | null; narrow: boolean }>("/ads/audience-estimate", { targeting: JSON.parse(debounced) }),
    staleTime: 60_000,
  });
}

/** How the ad will look in the feed. */
export function AdPreview({ business, ad }: { business: { name: string; logoUrl: string | null }; ad: { headline: string; body: string; cta: string; linkUrl: string; media: { preview?: string; url?: string; type: string }[] } }) {
  const host = (() => { try { return ad.linkUrl ? new URL(ad.linkUrl).hostname : ""; } catch { return ""; } })();
  const m = ad.media[0];
  const src = m?.preview ?? m?.url;
  return (
    <article className="overflow-hidden rounded-2xl border bg-card text-left">
      <header className="flex items-center gap-2.5 p-3">
        <BusinessLogo b={business} className="size-9 rounded-full" />
        <div><p className="text-sm font-semibold">{business.name || "Your business"}</p><p className="text-xs text-muted-foreground">Sponsored</p></div>
      </header>
      {ad.body && <p className="px-3 pb-2 text-sm whitespace-pre-wrap">{ad.body}</p>}
      {src ? (m!.type === "video" ? <video src={src} className="aspect-video w-full bg-black object-cover" muted /> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="aspect-video w-full object-cover" />
      )) : <div className="grid aspect-video w-full place-items-center bg-muted text-xs text-muted-foreground">Add a photo or video</div>}
      <div className="flex items-center justify-between gap-3 bg-muted/60 px-3 py-2.5">
        <div className="min-w-0">
          {host && <p className="truncate text-[11px] text-muted-foreground uppercase">{host}</p>}
          <p className="truncate text-sm font-semibold">{ad.headline || "Your headline"}</p>
        </div>
        <span className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold">{CTA_LABEL[ad.cta] ?? "Learn more"}</span>
      </div>
    </article>
  );
}
