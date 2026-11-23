"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ImagePlus, Loader2, Sparkles, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { useMyBusinesses } from "@/components/ads/ads-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, get, post } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { uploadMedia } from "@/lib/upload";
import { cn, toMinor } from "@/lib/utils";

interface Job { id: string; status: "queued" | "processing" | "ready" | "failed"; step: string; progress: number; campaignId: string | null; engine: string; error: string | null; steps: string[] }

export default function StudioPage() {
  return <Suspense><Studio /></Suspense>;
}

function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: biz } = useMyBusinesses();
  const businessId = params.get("b") ?? biz?.businesses[0]?.id ?? "";
  const { data: status } = useQuery({ queryKey: ["studio-status"], queryFn: () => get<{ aiEnabled: boolean; ffmpeg: boolean; jobsPerDay: number; maxVideoSec: number }>("/ads/studio") });
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<{ id: string; preview: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({ productName: "", concept: "", language: "banglish", goal: "sales", daily: "20", linkUrl: "", geo: "", autoPublish: false });
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const done = await Promise.all(Array.from(files).slice(0, 6 - media.length).map(async (file) => {
        const m = await uploadMedia(file, "ad");
        return { id: m.id, preview: URL.createObjectURL(file), type: file.type.startsWith("video/") ? "video" : "image" };
      }));
      setMedia((cur) => [...cur, ...done]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const start = useMutation({
    mutationFn: () => post<{ job: Job }>("/ads/studio/jobs", {
      businessId, mediaIds: media.map((m) => m.id), productName: f.productName, concept: f.concept, language: f.language, goal: f.goal,
      dailyBudgetMinor: toMinor(f.daily), autoPublish: f.autoPublish, ...(f.linkUrl ? { linkUrl: f.linkUrl } : {}),
      geo: f.geo.split(",").map((g) => g.trim()).filter(Boolean),
    }),
    onSuccess: ({ job }) => { setJobId(job.id); setJob(job); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Live progress over the socket, plus polling (the worker may run in a separate process)
  useEffect(() => {
    if (!jobId) return;
    const s = getSocket();
    const onProgress = (p: { jobId: string }) => { if (p.jobId === jobId) void get<{ job: Job }>(`/ads/studio/jobs/${jobId}`).then((r) => setJob(r.job)); };
    s.on("adjob:progress", onProgress);
    s.on("adjob:ready", onProgress);
    const t = setInterval(() => { void get<{ job: Job }>(`/ads/studio/jobs/${jobId}`).then((r) => setJob(r.job)).catch(() => {}); }, 2000);
    return () => { s.off("adjob:progress", onProgress); s.off("adjob:ready", onProgress); clearInterval(t); };
  }, [jobId]);
  const done = job?.status === "ready" || job?.status === "failed";

  const stepIndex = job ? Math.max(0, job.steps.indexOf(job.step)) : -1;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="size-6 text-primary" /> AI Ad Studio</h1>
        <Button variant="secondary" size="sm" asChild><Link href={`/ads?b=${businessId}`}><ArrowLeft /> Ads Manager</Link></Button>
      </div>
      {status && !status.aiEnabled && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">AI isn&apos;t connected yet, so the studio writes ads from templates using your description. Add an Anthropic API key on the server to turn on AI analysis and copywriting.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <Label>1 · Product photos or video</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative size-24 overflow-hidden rounded-lg border">
                  {m.type === "video" ? <video src={m.preview} className="size-full object-cover" muted /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.preview} alt="" className="size-full object-cover" />
                  )}
                  <button type="button" onClick={() => setMedia((cur) => cur.filter((x) => x.id !== m.id))} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove"><X className="size-3" /></button>
                </div>
              ))}
              {media.length < 6 && (
                <button type="button" onClick={() => fileRef.current?.click()} className="grid size-24 place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-accent" aria-label="Add photo or video">
                  {uploading ? <Spinner /> : <ImagePlus className="size-7" />}
                </button>
              )}
              <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Up to 6 files{status ? ` · videos up to ${status.maxVideoSec}s` : ""}.</p>
          </div>
          <div className="space-y-1"><Label htmlFor="s-name">2 · Product name</Label><Input id="s-name" value={f.productName} maxLength={120} onChange={(e) => setF((x) => ({ ...x, productName: e.target.value }))} placeholder="Wireless earbuds X2" /></div>
          <div className="space-y-1"><Label htmlFor="s-concept">Describe it (features, who it&apos;s for, price)</Label><Textarea id="s-concept" value={f.concept} maxLength={2000} onChange={(e) => setF((x) => ({ ...x, concept: e.target.value }))} className="min-h-24" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Language</Label>
              <div className="flex gap-1">{([["banglish", "Banglish"], ["en", "English"], ["bn", "বাংলা"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF((x) => ({ ...x, language: v }))} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-sm", f.language === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{l}</button>
              ))}</div>
            </div>
            <div className="space-y-1">
              <Label>Goal</Label>
              <div className="flex gap-1">{([["sales", "Sales"], ["messages", "Messages"], ["awareness", "Awareness"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF((x) => ({ ...x, goal: v }))} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-sm", f.goal === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{l}</button>
              ))}</div>
            </div>
            <div className="space-y-1"><Label htmlFor="s-daily">Daily budget ($)</Label><Input id="s-daily" inputMode="decimal" value={f.daily} onChange={(e) => setF((x) => ({ ...x, daily: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="s-geo">Places (optional)</Label><Input id="s-geo" value={f.geo} placeholder="Dhaka, Chattogram" onChange={(e) => setF((x) => ({ ...x, geo: e.target.value }))} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="s-link">Link (https, optional)</Label><Input id="s-link" value={f.linkUrl} onChange={(e) => setF((x) => ({ ...x, linkUrl: e.target.value.trim() }))} placeholder="https://your-shop.com/product" /></div>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span className="text-sm">Publish right away <span className="block text-xs text-muted-foreground">Runs as soon as your business page is approved and funded. Off = saved as a draft for you to check first.</span></span>
            <Switch checked={f.autoPublish} onCheckedChange={(v) => setF((x) => ({ ...x, autoPublish: v }))} />
          </label>
          <Button className="w-full" disabled={!businessId || !f.productName.trim() || (media.length === 0 && f.concept.trim().length < 15) || uploading || start.isPending || (!!jobId && !done)} onClick={() => start.mutate()}>
            {start.isPending ? <Spinner /> : <Sparkles />} Generate ad
          </Button>
        </section>

        <aside className="space-y-3 rounded-2xl border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
          <h2 className="font-bold">Progress</h2>
          {!job && <p className="text-sm text-muted-foreground">Your ad will be analysed, written in 3 variants, safety-checked and turned into a campaign.</p>}
          {job && (
            <ol className="space-y-2">
              {job.steps.map((s, i) => {
                const state = job.status === "ready" || i < stepIndex ? "done" : job.status === "failed" && i === stepIndex ? "failed" : i === stepIndex && job.status === "processing" ? "running" : "todo";
                return (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    {state === "done" ? <Check className="size-4 text-emerald-500" /> : state === "running" ? <Loader2 className="size-4 animate-spin text-primary" /> : state === "failed" ? <XCircle className="size-4 text-destructive" /> : <span className="size-4 rounded-full border" />}
                    <span className={state === "todo" ? "text-muted-foreground" : ""}>{s}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {job?.status === "failed" && <p className="text-sm text-destructive">{job.error}</p>}
          {job?.status === "ready" && job.campaignId && (
            <>
              <p className="text-sm text-muted-foreground">Done{job.engine === "template" ? " (template mode)" : ""}. Check the variants in your campaign.</p>
              <Button className="w-full" onClick={() => router.push(`/ads/${job.campaignId}`)}>Open campaign</Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
