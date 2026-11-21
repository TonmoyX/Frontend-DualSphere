"use client";

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ImagePlus, Lock, UserRound, VenetianMask, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnonAvatar, Spinner, UserAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorMessage, post } from "@/lib/api";
import type { FeedPage, Post, SharePolicy, Visibility } from "@/lib/types";
import { SharePolicyPicker } from "./share-policy";
import { uploadMedia, type UploadedMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

interface Pending {
  key: string;
  file: File;
  preview: string;
  progress: number;
  media?: UploadedMedia;
}

/**
 * Facebook-style composer: a one-line bar in the feed that opens a "Create post" modal.
 * The identity/anonymous choice lives inside the modal, under your name (like "Public ▾").
 * The draft survives closing the modal.
 */
export function PostComposer({ defaultMode = "identity" }: { defaultMode?: Visibility }) {
  const { user } = useAuth();
  const { features, limits } = useSettings();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<Visibility>(defaultMode);
  const [sharePolicy, setSharePolicy] = useState<SharePolicy>("everyone");
  const [files, setFiles] = useState<Pending[]>([]);

  const anonReason = !features.anonymousPostingEnabled
    ? "Anonymous posting is turned off by the admins"
    : user && !user.canPostAnonymously
      ? `Unlocks ${new Date(user.anonAvailableAt).toLocaleString()} — accounts must be ${limits.anonAccountAgeHours}h old`
      : null;
  const effectiveMode: Visibility = anonReason ? "identity" : mode;
  const anon = effectiveMode === "anonymous";
  const effectivePolicy: SharePolicy = anon && sharePolicy === "friends" ? "everyone" : sharePolicy;

  // Focus the text box when the modal opens
  useEffect(() => {
    if (open) setTimeout(() => textRef.current?.focus(), 50);
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      post<{ post: Post }>(anon ? "/posts/anonymous" : "/posts", { content, mediaIds: files.map((f) => f.media!.id), sharePolicy: effectivePolicy }),
    onSuccess: ({ post: p }) => {
      // Prepend to matching feeds (the socket echo is de-duplicated by id)
      for (const key of [["feed", "all"], ["feed", p.visibility]]) {
        qc.setQueryData<InfiniteData<FeedPage>>(key, (d) =>
          d ? { ...d, pages: [{ ...d.pages[0], posts: [p, ...d.pages[0].posts.filter((x) => x.id !== p.id)] }, ...d.pages.slice(1)] } : d,
        );
      }
      if (p.visibility === "identity") {
        qc.invalidateQueries({ queryKey: ["profile-posts", user?.username] });
        qc.invalidateQueries({ queryKey: ["photos"] });
      }
      setContent("");
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setOpen(false);
      toast.success(p.visibility === "anonymous" ? "Posted anonymously 🎭" : "Posted!");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Join the conversation — as yourself, or anonymously.</p>
        <Button asChild size="sm"><Link href="/login">Log in to post</Link></Button>
      </div>
    );
  }

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setOpen(true);
    const room = limits.maxMediaPerPost - files.length;
    const picked = Array.from(list).slice(0, room);
    if (list.length > room) toast.warning(`Max ${limits.maxMediaPerPost} attachments`);
    for (const file of picked) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && !features.videoUploadsEnabled) { toast.error("Video uploads are disabled"); continue; }
      const maxMb = isVideo ? limits.maxVideoMb : limits.maxImageMb;
      if (file.size > maxMb * 1024 * 1024) { toast.error(`${file.name} exceeds ${maxMb} MB`); continue; }
      const key = crypto.randomUUID();
      setFiles((f) => [...f, { key, file, preview: URL.createObjectURL(file), progress: 0 }]);
      uploadMedia(file, "post", (progress) => setFiles((f) => f.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then((media) => setFiles((f) => f.map((x) => (x.key === key ? { ...x, media, progress: 100 } : x))))
        .catch((e) => {
          toast.error(errorMessage(e));
          setFiles((f) => f.filter((x) => x.key !== key));
        });
    }
  };

  const uploading = files.some((f) => !f.media);
  const over = content.length > limits.maxPostLength;
  const canSubmit = !!(content.trim() || files.length) && !uploading && !over && !create.isPending;
  const first = user.displayName.split(" ")[0];
  const hasDraft = content.trim().length > 0 || files.length > 0;
  const pickMedia = () => fileRef.current?.click();

  return (
    <>
      {/* ── One-line bar ── */}
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-3 sm:gap-3 sm:p-4">
        <Link href={`/profile/${user.username}`} className="shrink-0">
          <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-10" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 min-w-0 flex-1 truncate rounded-full bg-muted px-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-accent"
        >
          {hasDraft ? <span className="text-foreground">{content.trim() || `${files.length} attachment${files.length > 1 ? "s" : ""}`}</span> : `What's on your mind, ${first}?`}
        </button>
        {features.mediaUploadsEnabled && (
          <button type="button" onClick={pickMedia} className="grid size-10 shrink-0 place-items-center rounded-full text-anon hover:bg-accent" aria-label="Add photo or video">
            <ImagePlus className="size-6" />
          </button>
        )}
        <Button onClick={() => setOpen(true)} className="hidden h-10 rounded-full px-5 font-semibold sm:inline-flex">Post</Button>
      </div>

      {features.mediaUploadsEnabled && (
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept={`image/jpeg,image/png,image/webp,image/gif,image/avif${features.videoUploadsEnabled ? ",video/mp4,video/webm,video/quicktime" : ""}`}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
      )}

      {/* ── Create post modal ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[540px]">
          <DialogHeader className="border-b px-4 py-3.5">
            <DialogTitle className="text-center font-sans text-lg font-bold tracking-normal">Create post</DialogTitle>
            <DialogDescription className="sr-only">Write a post as yourself or anonymously</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92dvh-8rem)] overflow-y-auto px-4 pt-4">
            {/* Who's posting + audience selector */}
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={effectiveMode} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.16 }}>
                  {anon ? <AnonAvatar className="size-11" /> : <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-11" />}
                </motion.div>
              </AnimatePresence>
              <div className="min-w-0">
                <p className={cn("truncate font-semibold", anon && "text-anon")}>{anon ? "Anonymous" : user.displayName}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "mt-0.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                      anon ? "bg-anon/15 text-anon hover:bg-anon/25" : "bg-muted hover:bg-accent",
                    )}
                  >
                    {anon ? <VenetianMask className="size-3.5" /> : <UserRound className="size-3.5" />}
                    {anon ? "Anonymous" : "Identity"}
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuItem onClick={() => setMode("identity")} className="items-start gap-3 py-2">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-identity/15 text-identity"><UserRound className="size-4" /></span>
                      <span className="flex-1">
                        <span className="block font-medium">Identity</span>
                        <span className="block text-xs text-muted-foreground">Posted as you · shows on your profile</span>
                      </span>
                      {!anon && <Check className="mt-1 size-4 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!!anonReason} onClick={() => setMode("anonymous")} className="items-start gap-3 py-2">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-anon/15 text-anon"><VenetianMask className="size-4" /></span>
                      <span className="flex-1">
                        <span className="block font-medium">Anonymous</span>
                        <span className="block text-xs text-muted-foreground">{anonReason ?? "No name, never on your profile"}</span>
                      </span>
                      {anon && <Check className="mt-1 size-4 text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="ml-1.5"><SharePolicyPicker value={effectivePolicy} onChange={setSharePolicy} mode={effectiveMode} /></span>
              </div>
            </div>

            <textarea
              ref={textRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={anon ? "Say what you really think. No one will know it's you." : `What's on your mind, ${first}?`}
              rows={files.length ? 3 : 5}
              className={cn(
                "mt-3 w-full resize-none bg-transparent leading-snug outline-none placeholder:text-muted-foreground",
                !files.length && content.length < 90 ? "text-2xl" : "text-[16px]",
              )}
              onKeyDown={(e) => {
                // Enter posts · Shift+Enter adds a new line (IME composition is respected)
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (canSubmit) create.mutate();
                }
              }}
              enterKeyHint="send"
            />

            {files.length > 0 && (
              <div className={cn("mb-3 grid gap-1.5 overflow-hidden rounded-xl border p-1.5", files.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {files.map((f) => (
                  <div key={f.key} className={cn("relative overflow-hidden rounded-lg bg-muted", files.length > 1 ? "aspect-square" : "max-h-80")}>
                    {f.file.type.startsWith("video/") ? (
                      <video src={f.preview} className="size-full max-h-80 object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="size-full max-h-80 object-cover" />
                    )}
                    {!f.media && <div className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">{f.progress}%</div>}
                    <button
                      type="button"
                      onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))}
                      className="absolute top-2 right-2 grid size-8 place-items-center rounded-full border bg-card/90 hover:bg-card"
                      aria-label="Remove"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <AnimatePresence>
              {anon && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-3 flex items-start gap-1.5 overflow-hidden rounded-lg bg-anon/10 px-3 py-2 text-xs text-anon"
                >
                  <Lock className="mt-0.5 size-3.5 shrink-0" /> Won&apos;t appear on your profile. Your identity is encrypted and only accessible through an audited admin process.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-3 px-4 pt-1 pb-4">
            <div className="flex items-center justify-between rounded-xl border px-4 py-2.5">
              <span className="text-sm font-semibold">Add to your post</span>
              <div className="flex items-center gap-1">
                <span className={cn("mr-2 text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>{content.length}/{limits.maxPostLength}</span>
                {features.mediaUploadsEnabled && (
                  <button
                    type="button"
                    onClick={pickMedia}
                    disabled={files.length >= limits.maxMediaPerPost}
                    className="grid size-9 place-items-center rounded-full text-anon hover:bg-accent disabled:opacity-40"
                    aria-label="Add photo or video"
                    title="Photo / video"
                  >
                    <ImagePlus className="size-6" />
                  </button>
                )}
              </div>
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={!canSubmit}
              className={cn("h-10 w-full text-[15px] font-semibold", anon && "bg-anon text-black hover:bg-anon/85")}
            >
              {create.isPending && <Spinner />} {uploading ? "Uploading…" : anon ? "Post anonymously" : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
