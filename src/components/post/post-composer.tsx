"use client";

import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ImagePlus, Lock, UserRound, UserRoundPlus, VenetianMask, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnonAvatar, Spinner, UserAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorMessage, get, post } from "@/lib/api";
import type { FeedPage, Post, PostTag, SharePolicy, Visibility } from "@/lib/types";
import { TaggedLine, TagPicker } from "./tag-picker";
import { SharePolicyPicker } from "./share-policy";
import { uploadMedia, type UploadedMedia } from "@/lib/upload";
import { cn, toMinor } from "@/lib/utils";
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
/** When posting into a community: its id/name and anonymous policy decide which modes are allowed. */
export interface ComposerCommunity { id: string; slug: string; name: string; anonPolicy: "off" | "allowed" | "anon_only"; visibility: "public" | "private" | "invite_only" }

export function PostComposer({ defaultMode = "identity", community, onPosted }: { defaultMode?: Visibility; community?: ComposerCommunity; onPosted?: (p: Post) => void }) {
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
  const [access, setAccess] = useState<"public" | "subscribers" | "paid">("public");
  const [price, setPrice] = useState("5");
  const [tags, setTags] = useState<PostTag[]>([]);
  const [tagging, setTagging] = useState(false);
  // Creators can post members-only or paid content (identity posts outside communities only)
  const { data: creatorMe } = useQuery({
    queryKey: ["creator-me", user?.id],
    queryFn: () => get<{ creator: { isActive: boolean; currency: "USD" } | null }>("/creators/me"),
    enabled: !!user && !community,
    staleTime: 60_000,
  });

  const anonReason = community?.anonPolicy === "off"
    ? "This community doesn't allow anonymous posts"
    : !features.anonymousPostingEnabled
      ? "Anonymous posting is turned off by the admins"
      : user && !user.canPostAnonymously
        ? `Unlocks ${new Date(user.anonAvailableAt).toLocaleString()} — accounts must be ${limits.anonAccountAgeHours}h old`
        : null;
  const identityReason = community?.anonPolicy === "anon_only" ? "This community only allows anonymous posts" : null;
  // anon-only community but you can't post anonymously yet → you can't post here at all
  const blockedReason = identityReason && anonReason ? anonReason : null;
  const effectiveMode: Visibility = identityReason ? "anonymous" : anonReason ? "identity" : mode;
  const canSell = !!creatorMe?.creator?.isActive && !community && effectiveMode === "identity";
  const effectiveAccess = canSell ? access : "public";
  const priceMinor = toMinor(price);
  // Posts in non-public communities (and paid posts) can't be shared outside, so there's no share setting to pick
  const showSharePicker = (!community || community.visibility === "public") && effectiveAccess === "public";
  const anon = effectiveMode === "anonymous";
  const effectivePolicy: SharePolicy = anon && sharePolicy === "friends" ? "everyone" : sharePolicy;
  // Tagging: identity posts outside communities only (an anonymous tag would point at you)
  const canTag = !anon && !community;
  const effectiveTags = canTag ? tags : [];

  // Focus the text box when the modal opens
  useEffect(() => {
    if (open) setTimeout(() => textRef.current?.focus(), 50);
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      post<{ post: Post }>(anon ? "/posts/anonymous" : "/posts", {
        content,
        mediaIds: files.map((f) => f.media!.id),
        sharePolicy: effectivePolicy,
        ...(effectiveTags.length ? { tagIds: effectiveTags.map((t) => t.id) } : {}),
        ...(community ? { communityId: community.id } : {}),
        ...(effectiveAccess !== "public" ? { access: effectiveAccess, ...(effectiveAccess === "paid" ? { priceMinor } : {}) } : {}),
      }),
    onSuccess: ({ post: p }) => {
      if (community) {
        // Community posts live in the community, never in the main feed
        onPosted?.(p);
        qc.invalidateQueries({ queryKey: ["feed", "communities"] });
        setContent("");
        files.forEach((f) => URL.revokeObjectURL(f.preview));
        setFiles([]);
        setOpen(false);
        toast.success(p.isPending ? "Sent to the moderators for approval" : p.visibility === "anonymous" ? "Posted anonymously 🎭" : "Posted!");
        return;
      }
      // Prepend to matching feeds (the socket echo is de-duplicated by id)
      for (const key of [["feed", "all"], ["feed", p.visibility]]) {
        qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: key }, (d) =>
          d ? { ...d, pages: [{ ...d.pages[0], posts: [p, ...d.pages[0].posts.filter((x) => x.id !== p.id)] }, ...d.pages.slice(1)] } : d,
        );
      }
      if (p.visibility === "identity") {
        qc.invalidateQueries({ queryKey: ["profile-posts", user?.username] });
        qc.invalidateQueries({ queryKey: ["photos"] });
      } else qc.invalidateQueries({ queryKey: ["my-anonymous"] }); // profile → Anonymous tab
      setContent("");
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setAccess("public");
      setTags([]);
      setTagging(false);
      setOpen(false);
      toast.success(p.visibility === "anonymous" ? "Posted anonymously 🎭" : p.access === "paid" ? "Paid post published" : p.access === "subscribers" ? "Members-only post published" : "Posted!");
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
  const canSubmit = !!(content.trim() || files.length) && !uploading && !over && !create.isPending && !blockedReason
    && (effectiveAccess !== "paid" || (Number.isFinite(priceMinor) && priceMinor >= 100));
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
          {blockedReason ? blockedReason : hasDraft ? <span className="text-foreground">{content.trim() || `${files.length} attachment${files.length > 1 ? "s" : ""}`}</span> : community ? `Write something in ${community.name}…` : `What's on your mind, ${first}?`}
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
                <p className={cn("line-clamp-2 font-semibold", anon && "text-anon")}>
                  {anon ? "Anonymous" : user.displayName}
                  {effectiveTags.length > 0 && <> <TaggedLine tags={effectiveTags} linked={false} className="font-normal" /></>}
                </p>
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
                    <DropdownMenuItem disabled={!!identityReason} onClick={() => setMode("identity")} className="items-start gap-3 py-2">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-identity/15 text-identity"><UserRound className="size-4" /></span>
                      <span className="flex-1">
                        <span className="block font-medium">Identity</span>
                        <span className="block text-xs text-muted-foreground">{identityReason ?? (community ? `Posted as you in ${community.name}` : "Posted as you · shows on your profile")}</span>
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
                {showSharePicker && <span className="ml-1.5"><SharePolicyPicker value={effectivePolicy} onChange={setSharePolicy} mode={effectiveMode} /></span>}
                {community && <p className="mt-1 truncate text-xs text-muted-foreground">Posting in <b className="font-semibold text-foreground">{community.name}</b></p>}
                {canSell && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {(["public", "subscribers", "paid"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAccess(a)}
                        className={cn("rounded-md px-2 py-0.5 font-semibold", access === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}
                      >
                        {a === "public" ? "Everyone" : a === "subscribers" ? "Members only" : "Paid"}
                      </button>
                    ))}
                    {access === "paid" && (
                      <span className="flex items-center gap-1">
                        $
                        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Price" className="h-6 w-16 rounded-md border bg-transparent px-1.5" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <textarea
              ref={textRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={anon ? "Say what you really think. Other users won't know it's you." : `What's on your mind, ${first}?`}
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

            {canTag && tagging && (
              <div className="mb-3">
                <TagPicker value={tags} onChange={setTags} onDone={() => setTagging(false)} />
              </div>
            )}
            {anon && tags.length > 0 && (
              <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Tags are removed from anonymous posts so no one can work out who wrote it.</p>
            )}

            <AnimatePresence>
              {anon && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-3 flex items-start gap-1.5 overflow-hidden rounded-lg bg-anon/10 px-3 py-2 text-xs text-anon"
                >
                  <Lock className="mt-0.5 size-3.5 shrink-0" /> Won&apos;t appear on your profile, and other users and moderators can&apos;t see it&apos;s you. Administrators can during a logged investigation. <a href="/privacy#admin-access" target="_blank" className="underline underline-offset-2">Learn more</a>
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-3 px-4 pt-1 pb-4">
            <div className="flex items-center justify-between rounded-xl border px-4 py-2.5">
              <span className="text-sm font-semibold">Add to your post</span>
              <div className="flex items-center gap-1">
                <span className={cn("mr-2 text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>{content.length}/{limits.maxPostLength}</span>
                {canTag && (
                  <button
                    type="button"
                    onClick={() => setTagging((t) => !t)}
                    className={cn("grid size-9 place-items-center rounded-full text-sky-500 hover:bg-accent", (tagging || tags.length > 0) && "bg-sky-500/10")}
                    aria-label="Tag people"
                    aria-pressed={tagging}
                    title="Tag people"
                  >
                    <UserRoundPlus className="size-6" />
                  </button>
                )}
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
