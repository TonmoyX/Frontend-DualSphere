"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, EyeOff, Flag, Info, MoreHorizontal, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BusinessLogo, CTA_LABEL, type PageBadge, PageBadgeIcon, type Placement } from "@/components/ads/ads-bits";
import { Spinner } from "@/components/common/bits";
import { MediaGrid } from "@/components/post/media-grid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface Ad {
  creativeId: string; token: string; sponsored: true; placement: Placement;
  business: { name: string; slug: string; logoUrl: string | null; isVerified: boolean; badge?: PageBadge };
  headline: string; body: string; cta: string; linkUrl: string | null; media: { id: string; url: string; type: "image" | "video"; mime?: string }[]; hashtags: string[];
}

const REPORT_REASONS = [
  { v: "misleading", label: "Misleading or false" }, { v: "scam", label: "Scam or fraud" }, { v: "offensive", label: "Offensive or hateful" },
  { v: "sexual", label: "Sexual content" }, { v: "violence", label: "Violence" }, { v: "prohibited", label: "Sells something prohibited" }, { v: "other", label: "Something else" },
] as const;

/** Counts a view once the ad is at least half visible for a second. */
function useImpression(ad: Ad | null | undefined) {
  const ref = useRef<HTMLElement>(null);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !ad || seen.current === ad.creativeId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        timer = setTimeout(() => {
          seen.current = ad.creativeId;
          void post("/ads/events", { token: ad.token, kind: "impression" }).catch(() => {});
          io.disconnect();
        }, 1000);
      } else if (timer) { clearTimeout(timer); timer = null; }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [ad]);
  return ref;
}

/** The "…" menu on every ad: why am I seeing this, hide, report (like Facebook). */
function AdMenu({ ad, onHidden }: { ad: Ad; onHidden: (msg: string) => void }) {
  const { user } = useAuth();
  const [whyOpen, setWhyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>("misleading");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const why = useQuery({ queryKey: ["ad-why", ad.creativeId], queryFn: () => post<{ business: { name: string }; reasons: string[] }>("/ads/why", { token: ad.token }), enabled: whyOpen, staleTime: Infinity });

  const hide = (scope: "ad" | "business") => post("/ads/hide", { token: ad.token, scope })
    .then(() => onHidden(scope === "ad" ? "Ad hidden. You won't see this ad again." : `You won't see ads from ${ad.business.name} any more.`))
    .catch((e) => toast.error(errorMessage(e)));
  const report = async () => {
    setBusy(true);
    try {
      await post("/ads/report", { token: ad.token, reason, ...(details.trim() ? { details: details.trim() } : {}) });
      setReportOpen(false);
      onHidden("Thanks — DualSphere will review this ad. It's hidden for you.");
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Ad options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem onClick={() => setWhyOpen(true)}><Info /> Why am I seeing this ad?</DropdownMenuItem>
          {user && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => hide("ad")}><EyeOff /> Hide ad</DropdownMenuItem>
              <DropdownMenuItem onClick={() => hide("business")}><Store /> Hide all ads from {ad.business.name}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReportOpen(true)}><Flag /> Report ad</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Why you&apos;re seeing this ad</DialogTitle><DialogDescription>From {ad.business.name}</DialogDescription></DialogHeader>
          {why.isLoading ? <Spinner className="mx-auto" /> : (
            <ul className="space-y-2 text-sm">
              {(why.data?.reasons ?? []).map((r) => <li key={r} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{r}</li>)}
            </ul>
          )}
          <DialogFooter>
            {user && <Button variant="secondary" onClick={() => { setWhyOpen(false); hide("business"); }}>Hide all ads from {ad.business.name}</Button>}
            <Button onClick={() => setWhyOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={(o) => !busy && setReportOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Report ad</DialogTitle><DialogDescription>DualSphere reviews reported ads. The advertiser won&apos;t know who reported it.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button key={r.v} type="button" onClick={() => setReason(r.v)} className={cn("rounded-lg border-2 px-3 py-2 text-left text-sm", reason === r.v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}>{r.label}</button>
            ))}
          </div>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Anything else? (optional)" className="min-h-16" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={report} disabled={busy}>{busy && <Spinner />} Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useSlot(slot: string, placement: Placement) {
  return useQuery({ queryKey: ["ad-slot", placement, slot], queryFn: () => get<{ ad: Ad | null }>(`/ads/slot?placement=${placement}`), staleTime: 10 * 60_000, retry: false });
}

function openAd(ad: Ad) {
  void post("/ads/events", { token: ad.token, kind: "click" }).catch(() => {});
  if (ad.linkUrl && ad.linkUrl.startsWith("https://")) window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
}

/** One Sponsored post in the feed or Reels. Always labelled, always from an approved business page, never anonymous. */
export function SponsoredCard({ slot, placement = "feed" }: { slot: number; placement?: "feed" | "reels" }) {
  const { data } = useSlot(String(slot), placement);
  const [hidden, setHidden] = useState<string | null>(null);
  const ad = data?.ad;
  const ref = useImpression(hidden ? null : ad);

  if (!ad) return null;
  if (hidden) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">{hidden}</div>;
  const safeLink = ad.linkUrl && ad.linkUrl.startsWith("https://") ? ad.linkUrl : null;

  return (
    <article ref={ref} className="rounded-2xl border bg-card p-4" aria-label={`Sponsored by ${ad.business.name}`}>
      <header className="flex items-center gap-3">
        <Link href={`/business/${ad.business.slug}`}><BusinessLogo b={ad.business} className="size-10" /></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/business/${ad.business.slug}`} className="flex items-center gap-1 font-semibold hover:underline">
            {ad.business.name} <PageBadgeIcon badge={ad.business.badge} />
          </Link>
          <p className="text-xs font-medium text-muted-foreground">Sponsored</p>
        </div>
        <AdMenu ad={ad} onHidden={setHidden} />
      </header>
      {ad.body && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{ad.body}</p>}
      {ad.hashtags.length > 0 && <p className="mt-1 text-sm text-primary">{ad.hashtags.join(" ")}</p>}
      {ad.media.length > 0 && <div className="-mx-4 mt-3"><MediaGrid media={ad.media} bleed /></div>}
      <div className="-mx-4 -mb-4 mt-3 flex items-center justify-between gap-3 rounded-b-2xl bg-muted/60 px-4 py-3">
        <div className="min-w-0">
          {safeLink && <p className="truncate text-[11px] text-muted-foreground uppercase">{new URL(safeLink).hostname}</p>}
          <p className="truncate font-semibold">{ad.headline}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => openAd(ad)}>{CTA_LABEL[ad.cta] ?? "Learn more"}{safeLink && <ExternalLink />}</Button>
      </div>
    </article>
  );
}

/** Desktop right column: up to two compact Sponsored ads (like Facebook's right rail). */
export function SponsoredSidebar() {
  const first = useSlot("side-1", "sidebar");
  const firstId = first.data?.ad?.creativeId;
  const second = useQuery({
    queryKey: ["ad-slot", "sidebar", "side-2", firstId],
    queryFn: () => get<{ ad: Ad | null }>(`/ads/slot?placement=sidebar${firstId ? `&exclude=${firstId}` : ""}`),
    enabled: first.isSuccess, staleTime: 10 * 60_000, retry: false,
  });
  const ads = [first.data?.ad, second.data?.ad].filter((a): a is Ad => !!a);
  if (!ads.length) return null;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Sponsored</h3>
      <div className="space-y-4">{ads.map((a) => <SidebarAd key={a.creativeId} ad={a} />)}</div>
    </div>
  );
}

function SidebarAd({ ad }: { ad: Ad }) {
  const [hidden, setHidden] = useState<string | null>(null);
  const ref = useImpression(hidden ? null : ad);
  if (hidden) return <p className="text-xs text-muted-foreground">{hidden}</p>;
  const m = ad.media.find((x) => x.type === "image") ?? ad.media[0];
  const host = ad.linkUrl?.startsWith("https://") ? new URL(ad.linkUrl).hostname : ad.business.name;
  return (
    <article ref={ref} className="group relative flex gap-3" aria-label={`Sponsored by ${ad.business.name}`}>
      <button type="button" onClick={() => openAd(ad)} className="flex min-w-0 flex-1 gap-3 text-left">
        {m ? (m.type === "video" ? <video src={m.url} muted className="size-24 shrink-0 rounded-lg object-cover" /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="" className="size-24 shrink-0 rounded-lg object-cover" />
        )) : <BusinessLogo b={ad.business} className="size-24 text-2xl" />}
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{ad.headline}</span>
          <span className="block truncate text-xs text-muted-foreground">{host}</span>
        </span>
      </button>
      <div className="absolute top-0 right-0 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"><AdMenu ad={ad} onHidden={setHidden} /></div>
    </article>
  );
}
