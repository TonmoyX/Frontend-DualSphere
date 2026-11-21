"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, get, post } from "@/lib/api";
import type { ChatMessage, Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConversationAvatar } from "./chat-avatar";
import { conversationName } from "./dm";

/**
 * Telegram's delete dialog.
 *  - Your message: "Also delete for <name>" (ticked → delete for everyone, unticked → delete for me)
 *  - Someone else's message: delete for me only
 */
export function DeleteMessageDialog({
  message, mine, conversation, onClose, onConfirm,
}: {
  message: ChatMessage | null;
  mine: boolean;
  conversation: Conversation;
  onClose: () => void;
  onConfirm: (scope: "me" | "everyone") => void;
}) {
  const [forAll, setForAll] = useState(true);
  const other = conversation.isGroup ? null : conversation.participants[0];
  const label = conversation.isGroup ? "Delete for everyone" : `Also delete for ${other?.displayName.split(" ")[0] ?? "them"}`;

  return (
    <AlertDialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete message</AlertDialogTitle>
          <AlertDialogDescription>
            {mine ? "Are you sure you want to delete this message?" : "This message will be deleted for you only. Others in the chat will still see it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mine && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-sm">
            <Checkbox checked={forAll} onCheckedChange={(v) => setForAll(v === true)} />
            {label}
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm(mine && forAll ? "everyone" : "me")}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Forward a message to one or more chats. */
export function ForwardDialog({ message, onClose }: { message: ChatMessage | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ["dm", "forward-targets"],
    queryFn: async () => (await get<{ conversations: Conversation[] }>("/conversations?folder=primary")).conversations,
    enabled: !!message,
  });
  const list = (data ?? []).filter((c) => !c.blockedByMe && !c.blockedMe && conversationName(c).toLowerCase().includes(q.toLowerCase()));
  const send = useMutation({
    mutationFn: () => post<{ forwardedTo: string[] }>(`/messages/${message!.id}/forward`, { conversationIds: picked }),
    onSuccess: (r) => {
      toast.success(r.forwardedTo.length === 1 ? "Message forwarded" : `Forwarded to ${r.forwardedTo.length} chats`);
      setPicked([]);
      setQ("");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={!!message} onOpenChange={(o) => { if (!o) { setPicked([]); setQ(""); onClose(); } }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="font-sans text-base tracking-normal">Forward to…</DialogTitle>
        </DialogHeader>
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none" />
          </div>
        </div>
        <div className="h-80 overflow-y-auto py-1">
          {isLoading && <Spinner className="mx-auto my-6 block" />}
          {!isLoading && list.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No chats found.</p>}
          {list.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/60"
              >
                <ConversationAvatar c={c} size={44} />
                <span className="min-w-0 flex-1 truncate font-medium">{conversationName(c)}</span>
                <span className={cn("grid size-5 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t p-3">
          <Button className="w-full" disabled={!picked.length || send.isPending} onClick={() => send.mutate()}>
            {send.isPending && <Spinner />} {picked.length > 1 ? `Forward to ${picked.length} chats` : "Forward"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
