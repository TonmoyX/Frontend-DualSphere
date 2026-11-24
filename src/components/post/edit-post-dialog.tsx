"use client";

import { useMutation } from "@tanstack/react-query";
import { ImagePlus, UserRoundPlus, VenetianMask, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, patch } from "@/lib/api";
import type { Media, Post, PostTag } from "@/lib/types";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useSettings } from "@/providers/settings-provider";
import { TaggedLine, TagPicker } from "./tag-picker";

/** A photo/video in the editor: already on the post, or a new upload (in progress until `media` is set). */
interface EditItem {
  key: string;
  url: string;
  type: Media["type"];
  id?: string; // set once the file is on the server (existing items always have one)
  progress?: number; // new uploads only
  isNew?: boolean;
}

const fromPost = (p: Post): EditItem[] => p.media.map((m, i) => ({ key: m.id ?? `${m.url}-${i}`, url: m.url, type: m.type, id: m.id }));

/** Edit your own post (identity or anonymous): text, photos & videos (add / remove), and tags. */
export function EditPostDialog({
  post,
  open,
  onOpenChange,
  onSaved,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (p: Post) => void;
}) {
  const { features, limits } = useSettings();
  const anon = post.visibility === "anonymous";
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(post.content);
  const [items, setItems] = useState<EditItem[]>(() => fromPost(post));
  const [tags, setTags] = useState<PostTag[]>(post.tags ?? []);
  const [tagging, setTagging] = useState(false);

  // Tags: identity posts outside communities only
  const canTag = !anon && !post.community;
  // Shares carry no media, and profile/cover photo posts keep their photo
  const canEditMedia = features.mediaUploadsEnabled && !post.isShare && (post.postType ?? "regular") === "regular";
  const sameTags = (a: PostTag[], b: PostTag[]) => a.length === b.length && a.every((t) => b.some((x) => x.id === t.id));
  const tagsChanged = canTag && !sameTags(tags, post.tags ?? []);
  const original = post.media.map((m) => m.id);
  const mediaChanged = items.length !== original.length || items.some((it, i) => it.id !== original[i]);
  const uploading = items.some((it) => it.isNew && !it.id);
  const canBeEmpty = items.length > 0 || !!post.isShare;
  const over = text.length > limits.maxPostLength;
  const textChanged = text.trim() !== post.content.trim();
  const unchanged = !textChanged && !tagsChanged && !mediaChanged;
  const canSave = !unchanged && !over && !uploading && (canBeEmpty || !!text.trim());

  const reset = () => {
    setText(post.content);
    setItems(fromPost(post));
    setTags(post.tags ?? []);
    setTagging(false);
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const room = limits.maxMediaPerPost - items.length;
    const picked = Array.from(list).slice(0, Math.max(room, 0));
    if (list.length > room) toast.warning(`Max ${limits.maxMediaPerPost} attachments`);
    for (const file of picked) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && !features.videoUploadsEnabled) { toast.error("Video uploads are disabled"); continue; }
      const maxMb = isVideo ? limits.maxVideoMb : limits.maxImageMb;
      if (file.size > maxMb * 1024 * 1024) { toast.error(`${file.name} exceeds ${maxMb} MB`); continue; }
      const key = crypto.randomUUID();
      setItems((all) => [...all, { key, url: URL.createObjectURL(file), type: isVideo ? "video" : "image", progress: 0, isNew: true }]);
      uploadMedia(file, "post", (progress) => setItems((all) => all.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then((m) => setItems((all) => all.map((x) => (x.key === key ? { ...x, id: m.id, progress: 100 } : x))))
        .catch((e) => {
          toast.error(errorMessage(e));
          setItems((all) => all.filter((x) => x.key !== key));
        });
    }
  };

  const removeItem = (it: EditItem) => {
    if (it.isNew) URL.revokeObjectURL(it.url);
    setItems((all) => all.filter((x) => x.key !== it.key));
  };

  const save = useMutation({
    mutationFn: () =>
      patch<{ post: Post }>(`/posts/${post.id}`, {
        ...(textChanged ? { content: text } : {}),
        ...(tagsChanged ? { tagIds: tags.map((t) => t.id) } : {}),
        ...(mediaChanged ? { mediaIds: items.map((it) => it.id).filter((id): id is string => !!id) } : {}),
      }),
    onSuccess: (r) => {
      items.filter((it) => it.isNew).forEach((it) => URL.revokeObjectURL(it.url));
      onSaved(r.post);
      toast.success("Post updated");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset(); // start from the latest post each time
        else items.filter((it) => it.isNew).forEach((it) => URL.revokeObjectURL(it.url));
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription className={cn(anon && "flex items-center gap-1.5 text-anon")}>
            {anon ? (
              <>
                <VenetianMask className="size-4" /> This post stays anonymous — other users won&apos;t see it&apos;s yours.
              </>
            ) : (
              "Your post will show as edited."
            )}
          </DialogDescription>
          {canTag && tags.length > 0 && <TaggedLine tags={tags} linked={false} />}
        </DialogHeader>

        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canBeEmpty ? "Say something about this… (optional)" : "What's on your mind?"}
          className="max-h-[40dvh] min-h-28 text-[15px]"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSave) save.mutate();
          }}
        />

        {/* Photos & videos: remove with ✕, add more with the button below */}
        {items.length > 0 && (
          <div className={cn("grid gap-1.5 overflow-hidden rounded-xl border p-1.5", items.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {items.map((it) => (
              <div key={it.key} className={cn("relative overflow-hidden rounded-lg bg-muted", items.length > 1 ? "aspect-square" : "max-h-72")}>
                {it.type === "video" ? (
                  <video src={it.url} className="size-full max-h-72 object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="size-full max-h-72 object-cover" />
                )}
                {it.isNew && !it.id && (
                  <div className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">{it.progress ?? 0}%</div>
                )}
                {canEditMedia && (
                  <button
                    type="button"
                    onClick={() => removeItem(it)}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full border bg-card/90 hover:bg-card"
                    aria-label={it.type === "video" ? "Remove video" : "Remove photo"}
                    title={it.type === "video" ? "Remove video" : "Remove photo"}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canTag && tagging && <TagPicker value={tags} onChange={setTags} onDone={() => setTagging(false)} />}

        <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
          <div className="flex items-center gap-1">
            {canEditMedia && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={items.length >= limits.maxMediaPerPost}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-anon hover:bg-anon/10 disabled:opacity-40"
              >
                <ImagePlus className="size-4" /> {features.videoUploadsEnabled ? "Photo / video" : "Photo"}
              </button>
            )}
            {canTag && (
              <button
                type="button"
                onClick={() => setTagging((t) => !t)}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-sky-500 hover:bg-sky-500/10", tagging && "bg-sky-500/10")}
              >
                <UserRoundPlus className="size-4" /> Tag people
              </button>
            )}
          </div>
          <span className={cn("text-xs tabular-nums text-muted-foreground", over && "text-destructive")}>
            {text.length}/{limits.maxPostLength}
          </span>
        </div>

        {canEditMedia && (
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept={`image/jpeg,image/png,image/webp,image/gif,image/avif${features.videoUploadsEnabled ? ",video/mp4,video/webm,video/quicktime" : ""}`}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSave}>
            {save.isPending && <Spinner />} {uploading ? "Uploading…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
