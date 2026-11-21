"use client";

import { Check, Heart, Mic, Paperclip, Pencil, Reply, SendHorizontal, Smile, Trash2, X } from "lucide-react";
import { RecordingBar, useVoiceRecorder } from "./voice";
import { Spinner } from "@/components/common/bits";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { errorMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { ChatMessage } from "@/lib/types";
import { uploadMedia, type UploadedMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useSettings } from "@/providers/settings-provider";
import { AnimatedEmoji, EMOJI_PICKER } from "./animated-emoji";

interface Pending {
  key: string;
  file: File;
  preview: string;
  progress: number;
  media?: UploadedMedia;
}

/**
 * Telegram-style composer: [📎] [message…] [😊] [➤]
 * Reply and edit show a bar with a coloured left border above the input.
 * Enter sends · Shift+Enter new line · Esc cancels reply/edit.
 */
export function Composer({
  conversationId,
  replyTo,
  editing,
  onCancel,
  onSend,
  onSaveEdit,
  myId,
}: {
  conversationId: string;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancel: () => void;
  onSend: (p: { content?: string; mediaIds?: string[]; heart?: boolean; media?: UploadedMedia[]; voiceDuration?: number }) => void;
  onSaveEdit: (m: ChatMessage, content: string) => void;
  myId: string;
}) {
  const { features, limits } = useSettings();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<{ on: boolean; timer?: ReturnType<typeof setTimeout> }>({ on: false });
  const voice = useVoiceRecorder();
  const [sendingVoice, setSendingVoice] = useState(false);

  const startVoice = async () => {
    try {
      await voice.start();
    } catch (e) {
      toast.error(e instanceof Error && e.name === "NotAllowedError" ? "Allow microphone access to record voice messages" : errorMessage(e));
    }
  };
  const sendVoice = async () => {
    const r = await voice.stop();
    if (!r) return;
    setSendingVoice(true);
    try {
      const ext = r.mime.includes("mp4") ? "m4a" : r.mime.includes("ogg") ? "ogg" : "webm";
      const file = new File([r.blob], `voice-${Date.now()}.${ext}`, { type: r.mime });
      const media = await uploadMedia(file, "message");
      onSend({ mediaIds: [media.id], media: [media], voiceDuration: r.duration });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSendingVoice(false);
    }
  };

  // Typing indicator: emit once, stop after 3s idle / on send / on unmount
  const setTyping = (on: boolean) => {
    const t = typingRef.current;
    if (t.timer) clearTimeout(t.timer);
    if (on) t.timer = setTimeout(() => setTyping(false), 3000);
    if (t.on === on) return;
    t.on = on;
    getSocket().emit("dm:typing", { conversationId, typing: on });
  };
  useEffect(() => () => setTyping(false), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entering edit mode pre-fills the text; reply just focuses
  const editingId = editing?.id;
  const [lastEditing, setLastEditing] = useState<string | undefined>(undefined);
  if (editingId !== lastEditing) {
    setLastEditing(editingId);
    if (editing) setText(editing.content);
    else if (lastEditing) setText("");
  }
  useEffect(() => {
    if (replyTo || editing) ta.current?.focus();
  }, [replyTo, editing]);

  // Auto-grow
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list).slice(0, 10 - files.length)) {
      const video = file.type.startsWith("video/");
      if (video && !features.videoUploadsEnabled) { toast.error("Video uploads are disabled"); continue; }
      const max = video ? limits.maxVideoMb : limits.maxImageMb;
      if (file.size > max * 1024 * 1024) { toast.error(`${file.name} is over ${max} MB`); continue; }
      const key = crypto.randomUUID();
      setFiles((f) => [...f, { key, file, preview: URL.createObjectURL(file), progress: 0 }]);
      uploadMedia(file, "message", (progress) => setFiles((f) => f.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then((media) => setFiles((f) => f.map((x) => (x.key === key ? { ...x, media, progress: 100 } : x))))
        .catch((e) => { toast.error(errorMessage(e)); setFiles((f) => f.filter((x) => x.key !== key)); });
    }
  };

  const uploading = files.some((f) => !f.media);
  const canSend = editing ? text.trim().length > 0 || editing.media.length > 0 : (text.trim() || files.length) && !uploading;

  const submit = () => {
    if (!canSend) return;
    if (editing) {
      if (text.trim() !== editing.content) onSaveEdit(editing, text.trim());
      onCancel();
      setText("");
      return;
    }
    onSend({ content: text.trim() || undefined, mediaIds: files.map((f) => f.media!.id), media: files.map((f) => f.media!) });
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setText("");
    setTyping(false);
  };

  const bar = editing ?? replyTo;

  return (
    <div className="border-t bg-card/95 px-2 pt-2 pb-3 backdrop-blur sm:px-4">
      {bar && (
        <div className="mb-2 flex items-center gap-3 px-1">
          {editing ? <Pencil className="size-5 shrink-0 text-primary" /> : <Reply className="size-5 shrink-0 text-primary" />}
          <div className="min-w-0 flex-1 border-l-[3px] border-primary pl-2.5">
            <div className="text-[13px] font-semibold text-primary">
              {editing ? "Edit message" : `Reply to ${replyTo!.sender?.id === myId ? "yourself" : replyTo!.sender?.displayName}`}
            </div>
            <div className="truncate text-[13px] text-muted-foreground">{bar.content || (bar.media.length ? "📷 Photo" : bar.kind === "heart" ? "❤️" : "")}</div>
          </div>
          <button onClick={() => { onCancel(); if (editing) setText(""); }} aria-label="Cancel" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto px-1">
          {files.map((f) => (
            <div key={f.key} className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
              {f.file.type.startsWith("video/") ? (
                <video src={f.preview} className="size-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt="" className="size-full object-cover" />
              )}
              {!f.media && <div className="absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-semibold text-white">{f.progress}%</div>}
              <button onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))} className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white" aria-label="Remove">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {voice.recording || sendingVoice ? (
        <div className="flex items-center gap-1.5">
          <button onClick={voice.cancel} disabled={sendingVoice} className="grid size-11 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10" aria-label="Cancel recording">
            <Trash2 className="size-5" />
          </button>
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-3xl bg-muted">
            {sendingVoice ? <span className="px-4 text-sm text-muted-foreground">Sending voice message…</span> : <RecordingBar seconds={voice.seconds} levels={voice.levels} max={voice.max} />}
          </div>
          <button onClick={sendVoice} disabled={sendingVoice} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md" aria-label="Send voice message">
            {sendingVoice ? <Spinner /> : <SendHorizontal className="size-5" />}
          </button>
        </div>
      ) : (
      <div className="flex items-end gap-1.5">
        <div className="flex min-w-0 flex-1 items-end rounded-3xl bg-muted px-1.5">
          {features.mediaUploadsEnabled && !editing && (
            <>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple
                accept={`image/jpeg,image/png,image/webp,image/gif,image/avif${features.videoUploadsEnabled ? ",video/mp4,video/webm,video/quicktime" : ""}`}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <button onClick={() => fileRef.current?.click()} className="mb-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Attach photo or video">
                <Paperclip className="size-5 -rotate-45" />
              </button>
            </>
          )}
          <textarea
            ref={ta}
            rows={1}
            value={text}
            maxLength={2000}
            onChange={(e) => { setText(e.target.value); if (!editing) setTyping(e.target.value.length > 0); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
              if (e.key === "Escape" && bar) { onCancel(); if (editing) setText(""); }
            }}
            enterKeyHint="send"
            placeholder="Message"
            aria-label="Message"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] leading-5 outline-none placeholder:text-muted-foreground"
          />
          {!text && !files.length && !editing && (
            <button onClick={() => onSend({ heart: true })} className="mb-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-pink-500" aria-label="Send a heart">
              <Heart className="size-5" />
            </button>
          )}
          <Popover>
            <PopoverTrigger className="mb-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Emoji">
              <Smile className="size-5" />
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[320px] p-2">
              <div className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto">
                {EMOJI_PICKER.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setText((t) => t + e); ta.current?.focus(); }}
                    className="grid aspect-square place-items-center rounded-lg transition-transform hover:scale-110 hover:bg-accent"
                    aria-label={e}
                  >
                    <AnimatedEmoji emoji={e} size={28} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {canSend || uploading || editing ? (
          <button
            onClick={submit}
            disabled={!canSend}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-50"
            aria-label={editing ? "Save" : "Send"}
          >
            {editing ? <Check className="size-5" strokeWidth={3} /> : <SendHorizontal className="size-5" />}
          </button>
        ) : (
          <button
            onClick={startVoice}
            className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105")}
            aria-label="Record voice message"
            title="Record voice message"
          >
            <Mic className="size-5" />
          </button>
        )}
      </div>
      )}
    </div>
  );
}
