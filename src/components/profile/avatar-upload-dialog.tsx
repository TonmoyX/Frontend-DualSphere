"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera, Rss } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { errorMessage, put } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { uploadMedia } from "@/lib/upload";

/**
 * Profile-picture update with preview and a "Share to feed" switch.
 * Opens the file picker immediately; the dialog appears once a photo is chosen.
 */
export function AvatarUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Opening = open the native picker
  useEffect(() => {
    if (open && !file) input.current?.click();
  }, [open, file]);

  const close = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setShare(true);
    setProgress(0);
    onOpenChange(false);
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const m = await uploadMedia(file, "avatar", setProgress);
      const { user } = await put<{ user: SelfUser }>("/users/me", { avatarMediaId: m.id, shareAvatarToFeed: share });
      qc.setQueryData(["me"], user);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-posts"] });
      if (share) qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success(share ? "Profile picture updated and shared to the feed" : "Profile picture updated");
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return onOpenChange(false);
          setFile(f);
          setPreview(URL.createObjectURL(f));
        }}
      />
      <Dialog open={open && !!file} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update profile picture</DialogTitle>
            <DialogDescription>Location and device data are removed from the photo before upload.</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img src={preview} alt="New profile picture preview" className="size-56 rounded-full border-4 border-card object-cover shadow-xl" />}
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full border bg-card shadow hover:bg-accent"
                aria-label="Choose a different photo"
              >
                <Camera className="size-5" />
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span className="flex items-start gap-3">
              <Rss className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">Share to feed</span>
                <span className="block text-xs text-muted-foreground">Post an update so people see your new profile picture.</span>
              </span>
            </span>
            <Switch checked={share} onCheckedChange={setShare} disabled={busy} />
          </label>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Spinner />} {busy ? (progress < 100 ? `Uploading ${progress}%` : "Saving…") : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
