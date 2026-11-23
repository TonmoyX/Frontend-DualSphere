"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { AdPreview, CTA_LABEL, type Objective, OBJECTIVES, type Placement, PLACEMENT_LABEL, useAudienceEstimate, useMyBusinesses } from "@/components/ads/ads-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, post } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { cn, toMinor } from "@/lib/utils";

interface Draft { headline: string; body: string; cta: string; linkUrl: string; media: { id: string; preview: string; type: string }[]; claimsConfirmed: boolean; uploading: boolean }
const blank = (): Draft => ({ headline: "", body: "", cta: "learn_more", linkUrl: "", media: [], claimsConfirmed: false, uploading: false });
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const STEPS = ["Campaign", "Ad set", "Ads"] as const;

export default function NewCampaignPage() {
  return <Suspense><NewCampaign /></Suspense>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div><h2 className="font-bold">{title}</h2>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
    </section>
  );
}

function NewCampaign() {
  const params = useSearchParams();
  const router = useRouter();
  const { data } = useMyBusinesses();
  const businessId = params.get("b") ?? data?.businesses[0]?.id ?? "";
  const business = data?.businesses.find((b) => b.id === businessId);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [step, setStep] = useState(0);
  const [c, setC] = useState({ name: "", objective: "traffic" as Objective, budgetType: "daily" as "daily" | "lifetime", daily: "10", total: "", startsAt: "", endsAt: "" });
  const [s, setS] = useState({
    name: "Ad set 1", geo: "", ageMin: "18", ageMax: "65", gender: "all" as "all" | "male" | "female", interests: "",
    placements: ["feed", "sidebar", "reels"] as Placement[], billingEvent: "click" as "impression" | "click",
    bidStrategy: "lowest_cost" as "lowest_cost" | "bid_cap", bid: "", frequencyCap: "3",
  });
  const [creatives, setCreatives] = useState<Draft[]>([blank()]);
  const [active, setActive] = useState(0);
  const setCr = (i: number, patch: Partial<Draft>) => setCreatives((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const targeting = {
    geo: list(s.geo), ageMin: Number(s.ageMin) || 18, ageMax: Number(s.ageMax) || 65,
    interests: list(s.interests), genders: s.gender === "all" ? [] : [s.gender],
  };
  const estimate = useAudienceEstimate(targeting);

  const pickObjective = (o: Objective) => {
    setC((x) => ({ ...x, objective: o }));
    setS((x) => ({ ...x, billingEvent: OBJECTIVES.find((y) => y.v === o)!.billing }));
  };

  const upload = async (i: number, files: FileList | null) => {
    if (!files?.length) return;
    setCr(i, { uploading: true });
    try {
      const done = await Promise.all(Array.from(files).slice(0, 5 - creatives[i]!.media.length).map(async (file) => {
        const m = await uploadMedia(file, "ad");
        return { id: m.id, preview: URL.createObjectURL(file), type: file.type.startsWith("video/") ? "video" : "image" };
      }));
      setCreatives((cur) => cur.map((x, j) => (j === i ? { ...x, media: [...x.media, ...done], uploading: false } : x)));
    } catch (e) {
      toast.error(errorMessage(e));
      setCr(i, { uploading: false });
    }
  };

  // Budget: daily, or lifetime spread over the schedule (daily cap = lifetime / days)
  const days = c.startsAt && c.endsAt ? Math.max(1, Math.ceil((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 86_400_000)) : null;
  const dailyMinor = c.budgetType === "daily" ? toMinor(c.daily) : days ? Math.ceil(toMinor(c.total) / days) : Number.NaN;
  const totalMinor = c.budgetType === "lifetime" ? toMinor(c.total) : c.total ? toMinor(c.total) : null;

  const create = useMutation({
    mutationFn: (submit: boolean) => post<{ campaign: { id: string; status: string } }>("/ads/campaigns", {
      businessId, name: c.name, objective: c.objective, dailyBudgetMinor: dailyMinor,
      ...(totalMinor ? { totalBudgetMinor: totalMinor } : {}),
      ...(c.startsAt ? { startsAt: new Date(c.startsAt).toISOString() } : {}),
      ...(c.endsAt ? { endsAt: new Date(c.endsAt).toISOString() } : {}),
      adSet: {
        name: s.name, targeting, placements: s.placements, billingEvent: s.billingEvent, bidStrategy: s.bidStrategy,
        ...(s.bidStrategy === "bid_cap" && s.bid ? (s.billingEvent === "click" ? { bidCpcMinor: toMinor(s.bid) } : { bidCpmMinor: toMinor(s.bid) }) : {}),
        frequencyCap: Number(s.frequencyCap) || 3,
      },
      creatives: creatives.map((x) => ({ headline: x.headline, body: x.body, cta: x.cta, linkUrl: x.linkUrl || null, mediaIds: x.media.map((m) => m.id), claimsConfirmed: x.claimsConfirmed })),
      submit,
    }),
    onSuccess: ({ campaign }) => {
      toast.success(campaign.status === "active" ? "Your campaign is live" : campaign.status === "draft" ? "Saved as draft" : "Published — it starts as soon as your business page is approved");
      router.push(`/ads/${campaign.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const stepValid = [
    c.name.trim().length >= 2 && Number.isFinite(dailyMinor) && dailyMinor >= 500 && (c.budgetType === "daily" || (!!days && Number.isFinite(totalMinor ?? Number.NaN))),
    s.placements.length > 0 && Number(s.ageMin) >= 13 && Number(s.ageMax) >= Number(s.ageMin) && (s.bidStrategy === "lowest_cost" || Number.isFinite(toMinor(s.bid))),
    creatives.every((x) => x.headline.trim() && !x.uploading && (!x.linkUrl || x.linkUrl.startsWith("https://"))),
  ];
  const cur = creatives[Math.min(active, creatives.length - 1)]!;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Create campaign{business ? ` · ${business.name}` : ""}</h1>
        <Button variant="secondary" size="sm" asChild><Link href={`/ads?b=${businessId}`}><ArrowLeft /> Ads Manager</Link></Button>
      </div>

      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button type="button" disabled={i > step && !stepValid.slice(0, i).every(Boolean)} onClick={() => setStep(i)}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1", i === step ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground", i < step && "text-foreground")}>
              <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", i < step ? "bg-primary text-primary-foreground" : "bg-muted")}>{i < step ? <Check className="size-3" /> : i + 1}</span>{label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {step === 0 && (
            <>
              <Section title="Campaign objective" hint="What do you want people to do? This sets how DualSphere delivers and charges for your ads.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {OBJECTIVES.map((o) => (
                    <button key={o.v} type="button" onClick={() => pickObjective(o.v)} className={cn("flex items-start gap-3 rounded-xl border-2 p-3 text-left", c.objective === o.v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
                      <o.Icon className="mt-0.5 size-5 text-primary" />
                      <span><span className="block font-semibold">{o.label}</span><span className="block text-xs text-muted-foreground">{o.desc}</span></span>
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Campaign details">
                <div className="space-y-1"><Label htmlFor="c-name">Campaign name</Label><Input id="c-name" value={c.name} maxLength={80} placeholder="e.g. Winter sale" onChange={(e) => setC((x) => ({ ...x, name: e.target.value }))} /></div>
              </Section>
              <Section title="Budget & schedule" hint="You're never charged more than your budget. Ads stop when your prepaid balance runs out.">
                <div className="flex rounded-lg border p-0.5 text-sm font-medium sm:w-fit">
                  {(["daily", "lifetime"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setC((x) => ({ ...x, budgetType: t }))} className={cn("rounded-md px-3 py-1 capitalize", c.budgetType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t} budget</button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {c.budgetType === "daily" ? (
                    <>
                      <div className="space-y-1"><Label htmlFor="c-daily">Daily budget ($)</Label><Input id="c-daily" inputMode="decimal" value={c.daily} onChange={(e) => setC((x) => ({ ...x, daily: e.target.value }))} /><p className="text-xs text-muted-foreground">Minimum $5.00 a day</p></div>
                      <div className="space-y-1"><Label htmlFor="c-cap">Total spending limit (optional)</Label><Input id="c-cap" inputMode="decimal" value={c.total} onChange={(e) => setC((x) => ({ ...x, total: e.target.value }))} /></div>
                    </>
                  ) : (
                    <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-total">Lifetime budget ($)</Label><Input id="c-total" inputMode="decimal" value={c.total} onChange={(e) => setC((x) => ({ ...x, total: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">{days ? `Spread over ${days} day${days > 1 ? "s" : ""} — up to $${Number.isFinite(dailyMinor) ? (dailyMinor / 100).toFixed(2) : "0.00"} a day` : "Set a start and end date below"}</p></div>
                  )}
                  <div className="space-y-1"><Label htmlFor="c-start">Start</Label><Input id="c-start" type="datetime-local" value={c.startsAt} onChange={(e) => setC((x) => ({ ...x, startsAt: e.target.value }))} /><p className="text-xs text-muted-foreground">Empty = start now</p></div>
                  <div className="space-y-1"><Label htmlFor="c-end">End {c.budgetType === "lifetime" ? "" : "(optional)"}</Label><Input id="c-end" type="datetime-local" value={c.endsAt} onChange={(e) => setC((x) => ({ ...x, endsAt: e.target.value }))} /></div>
                </div>
              </Section>
            </>
          )}

          {step === 1 && (
            <>
              <Section title="Audience" hint="Targeting uses only what people put on their own profile. Signed-out visitors only see ads with no targeting.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor="s-name">Ad set name</Label><Input id="s-name" value={s.name} maxLength={80} onChange={(e) => setS((x) => ({ ...x, name: e.target.value }))} /></div>
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor="s-geo">Locations (comma separated, empty = everywhere)</Label><Input id="s-geo" value={s.geo} placeholder="Dhaka, Chattogram" onChange={(e) => setS((x) => ({ ...x, geo: e.target.value }))} /></div>
                  <div className="space-y-1"><Label htmlFor="s-amin">Age from</Label><Input id="s-amin" inputMode="numeric" value={s.ageMin} onChange={(e) => setS((x) => ({ ...x, ageMin: e.target.value }))} /></div>
                  <div className="space-y-1"><Label htmlFor="s-amax">Age to</Label><Input id="s-amax" inputMode="numeric" value={s.ageMax} onChange={(e) => setS((x) => ({ ...x, ageMax: e.target.value }))} /></div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Gender</Label>
                    <div className="flex gap-1.5">
                      {(["all", "male", "female"] as const).map((g) => (
                        <button key={g} type="button" onClick={() => setS((x) => ({ ...x, gender: g }))} className={cn("rounded-full border px-3 py-1 text-sm capitalize", s.gender === g ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{g === "all" ? "All" : g === "male" ? "Men" : "Women"}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor="s-int">Detailed targeting: interests (people&apos;s hobbies)</Label><Input id="s-int" value={s.interests} placeholder="football, music, gaming" onChange={(e) => setS((x) => ({ ...x, interests: e.target.value }))} /></div>
                </div>
              </Section>
              <Section title="Placements" hint="Where your ads appear. Leaving all on gives the best results for the price.">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((p) => {
                    const on = s.placements.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => setS((x) => ({ ...x, placements: on ? x.placements.filter((y) => y !== p) : [...x.placements, p] }))}
                        className={cn("flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm", on ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}>
                        <span className={cn("grid size-4 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on && <Check className="size-3" />}</span>{PLACEMENT_LABEL[p]}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Optimisation & delivery">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>When you get charged</Label>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {([["impression", "Impressions (per 1,000 views)", "Good for awareness"], ["click", "Link clicks", "Pay only when someone clicks"]] as const).map(([v, l, h]) => (
                        <button key={v} type="button" onClick={() => setS((x) => ({ ...x, billingEvent: v }))} className={cn("rounded-lg border-2 px-3 py-2 text-left", s.billingEvent === v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}>
                          <span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-muted-foreground">{h}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Bid strategy</Label>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <button type="button" onClick={() => setS((x) => ({ ...x, bidStrategy: "lowest_cost" }))} className={cn("rounded-lg border-2 px-3 py-2 text-left", s.bidStrategy === "lowest_cost" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}>
                        <span className="block text-sm font-semibold">Lowest cost</span><span className="block text-xs text-muted-foreground">Standard price: {s.billingEvent === "click" ? "$0.20 per click" : "$2.00 per 1,000 views"}</span>
                      </button>
                      <button type="button" onClick={() => setS((x) => ({ ...x, bidStrategy: "bid_cap" }))} className={cn("rounded-lg border-2 px-3 py-2 text-left", s.bidStrategy === "bid_cap" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}>
                        <span className="block text-sm font-semibold">Bid cap</span><span className="block text-xs text-muted-foreground">Bid higher to win more often</span>
                      </button>
                    </div>
                  </div>
                  {s.bidStrategy === "bid_cap" && (
                    <div className="space-y-1"><Label htmlFor="s-bid">{s.billingEvent === "click" ? "Price per click ($, min 0.05)" : "Price per 1,000 views ($, min 0.50)"}</Label><Input id="s-bid" inputMode="decimal" value={s.bid} onChange={(e) => setS((x) => ({ ...x, bid: e.target.value }))} /></div>
                  )}
                  <div className="space-y-1"><Label htmlFor="s-freq">Frequency cap (views per person per day)</Label><Input id="s-freq" inputMode="numeric" value={s.frequencyCap} onChange={(e) => setS((x) => ({ ...x, frequencyCap: e.target.value }))} /></div>
                </div>
              </Section>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {creatives.map((x, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)} className={cn("rounded-full border px-3 py-1 text-sm", i === active ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>Ad {String.fromCharCode(65 + i)}{!x.headline.trim() && " •"}</button>
                ))}
                {creatives.length < 5 && <Button size="sm" variant="ghost" onClick={() => { setCreatives((cr) => [...cr, blank()]); setActive(creatives.length); }}><Plus /> Add variation (A/B test)</Button>}
              </div>
              <Section title={`Ad ${String.fromCharCode(65 + active)}`} hint="DualSphere automatically shows more of the variation that gets more clicks.">
                <div className="space-y-1"><Label>Primary text</Label><Textarea value={cur.body} maxLength={600} placeholder="Tell people what your ad is about" className="min-h-24" onChange={(e) => setCr(active, { body: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Photo or video</Label>
                  <div className="flex flex-wrap gap-2">
                    {cur.media.map((m) => (
                      <div key={m.id} className="relative size-20 overflow-hidden rounded-lg border">
                        {m.type === "video" ? <video src={m.preview} className="size-full object-cover" muted /> : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.preview} alt="" className="size-full object-cover" />
                        )}
                        <button type="button" onClick={() => setCr(active, { media: cur.media.filter((x) => x.id !== m.id) })} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove file"><X className="size-3" /></button>
                      </div>
                    ))}
                    {cur.media.length < 5 && (
                      <button type="button" onClick={() => fileRefs.current[active]?.click()} className="grid size-20 place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-accent" aria-label="Add photo or video">
                        {cur.uploading ? <Spinner /> : <ImagePlus className="size-6" />}
                      </button>
                    )}
                    <input ref={(el) => { fileRefs.current[active] = el; }} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(e) => { upload(active, e.target.files); e.target.value = ""; }} />
                  </div>
                </div>
                <div className="space-y-1"><Label>Headline</Label><Input value={cur.headline} maxLength={90} placeholder="A short, clear headline" onChange={(e) => setCr(active, { headline: e.target.value })} /></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Website URL</Label><Input value={cur.linkUrl} placeholder="https://your-site.com" onChange={(e) => setCr(active, { linkUrl: e.target.value.trim() })} /></div>
                  <div className="space-y-1">
                    <Label>Call to action</Label>
                    <select value={cur.cta} onChange={(e) => setCr(active, { cta: e.target.value })} className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm">
                      {Object.entries(CTA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                {creatives.length > 1 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setCreatives((cr) => cr.filter((_, j) => j !== active)); setActive(0); }}><Trash2 /> Remove this variation</Button>}
              </Section>
            </>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}><ArrowLeft /> Back</Button>
            {step < 2 ? (
              <Button onClick={() => setStep((x) => x + 1)} disabled={!stepValid[step]}>Next <ArrowRight /></Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => create.mutate(false)} disabled={!stepValid.every(Boolean) || create.isPending}>Save draft</Button>
                <Button onClick={() => create.mutate(true)} disabled={!stepValid.every(Boolean) || create.isPending}>{create.isPending && <Spinner />} Publish</Button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Estimated audience size</p>
            <p className="mt-1 text-xl font-bold">
              {estimate.isLoading ? "…" : estimate.data?.label ?? `${estimate.data?.lower?.toLocaleString()} – ${estimate.data?.upper.toLocaleString()} people`}
            </p>
            {estimate.data?.narrow && <p className="text-xs text-muted-foreground">Your audience is small. Widen locations, ages or interests to reach more people.</p>}
            <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Objective:</span> {OBJECTIVES.find((o) => o.v === c.objective)?.label}</p>
              <p><span className="font-medium text-foreground">Budget:</span> {Number.isFinite(dailyMinor) ? `$${(dailyMinor / 100).toFixed(2)} a day` : "—"}{totalMinor ? ` · $${(totalMinor / 100).toFixed(2)} total` : ""}</p>
              <p><span className="font-medium text-foreground">Placements:</span> {s.placements.map((p) => PLACEMENT_LABEL[p]).join(", ") || "—"}</p>
              <p><span className="font-medium text-foreground">Charged per:</span> {s.billingEvent === "click" ? "link click" : "1,000 impressions"}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Ad preview · Feed</p>
            <AdPreview business={{ name: business?.name ?? "", logoUrl: business?.logoUrl ?? null }} ad={cur} />
          </div>
        </aside>
      </div>
    </div>
  );
}
