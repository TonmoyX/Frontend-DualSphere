"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, ImagePlus, Type, Users, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, post } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useSettings } from "@/providers/settings-provider";

export const STORY_BACKGROUNDS = [
  "linear-gradient(135deg,#6c63ff,#a855f7)",
  "linear-gradient(135deg,#22d3a0,#0ea5e9)",
  "linear-gradient(135deg,#f97316,#ec4899)",
  "linear-gradient(135deg,#0f172a,#334155)",
  "linear-gradient(135deg,#facc15,#f97316)",
  "linear-gradient(135deg,#ef4444,#7c3aed)",
];

/** Create a photo/video story or a text story on a coloured background. */
export function CreateStoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { features, limits } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"pick" | "media" | "text">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bg, setBg] = useState(STORY_BACKGROUNDS[0]);
  const [audience, setAudience] = useState<"friends" | "public">("friends");
  const [progress, setProgress] = useState(0);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setMode("pick"); setFile(null); setPreview(null); setText(""); setBg(STORY_BACKGROUNDS[0]); setProgress(0);
  };
  const close = () => { reset(); onOpenChange(false); };

  const share = useMutation({
    mutationFn: async () => {
      if (mode === "media" && file) {
        const m = await uploadMedia(file, "story", setProgress);
        return post("/stories", { mediaId: m.id, audience });
      }
      return post("/stories", { text, background: bg, audience });
    },
    onSuccess: () => {
      toast.success("Your story is live for 24 hours");
      qc.invalidateQueries({ queryKey: ["stories"] });
      close();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pick = (f?: File) => {
    if (!f) return;
    const video = f.type.startsWith("video/");
    const max = video ? limits.maxVideoMb : limits.maxImageMb;
    if (video && !features.videoUploadsEnabled) return toast.error("Video uploads are disabled");
    if (f.size > max * 1024 * 1024) return toast.error(`Max ${max} MB`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode("media");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !share.isPending && close()}>
      <DialogContent className="max-h-[94dvh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-center font-sans text-lg font-bold tracking-normal">Create story</DialogTitle>
          <DialogDescription className="sr-only">Share a photo, video or text for 24 hours</DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" hidden accept={`image/jpeg,image/png,image/webp,image/gif${features.videoUploadsEnabled ? ",video/mp4,video/webm,video/quicktime" : ""}`} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

        {mode === "pick" ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            <button onClick={() => fileRef.current?.click()} className="flex aspect-[9/14] flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg transition-transform hover:scale-[1.02]">
              <span className="grid size-12 place-items-center rounded-full bg-white/25"><ImagePlus className="size-6" /></span>
              <span className="font-semibold">Photo / video</span>
            </button>
            <button onClick={() => setMode("text")} className="flex aspect-[9/14] flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white shadow-lg transition-transform hover:scale-[1.02]">
              <span className="grid size-12 place-items-center rounded-full bg-white/25"><Type className="size-6" /></span>
              <span className="font-semibold">Text</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* 9:16 preview */}
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl bg-black shadow-xl" style={mode === "text" ? { background: bg } : undefined}>
              {mode === "media" && preview && (file?.type.startsWith("video/")
                ? <video src={preview} autoPlay muted loop playsInline className="size-full object-contain" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={preview} alt="" className="size-full object-contain" />)}
              {mode === "text" && (
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                  placeholder="Start typing"
                  className="absolute inset-0 resize-none bg-transparent p-6 text-center text-2xl leading-snug font-bold text-white outline-none placeholder:text-white/60"
                  style={{ paddingTop: "40%" }}
                />
              )}
              <button onClick={reset} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Start over">
                <X className="size-4" />
              </button>
              {share.isPending && mode === "media" && (
                <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">{progress < 100 ? `Uploading ${progress}%` : "Sharing…"}</div>
              )}
            </div>

            {mode === "text" && (
              <div className="flex justify-center gap-2">
                {STORY_BACKGROUNDS.map((b) => (
                  <button key={b} onClick={() => setBg(b)} className={cn("size-8 rounded-full ring-offset-2 ring-offset-background", bg === b && "ring-2 ring-primary")} style={{ background: b }} aria-label="Background" />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {([["friends", "Friends", Users], ["public", "Public", Globe]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setAudience(v)}
                  className={cn("flex items-center justify-center gap-2 rounded-xl border-2 py-2 text-sm font-semibold", audience === v ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted")}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>

            <Button className="h-11 w-full font-semibold" disabled={share.isPending || (mode === "text" && !text.trim())} onClick={() => share.mutate()}>
              {share.isPending && <Spinner />} Share to story
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
