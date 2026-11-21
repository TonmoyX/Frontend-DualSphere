"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban, BellOff, LogOut, Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar, VerifiedMark } from "@/components/common/bits";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { del, errorMessage, patch, post } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { conversationName, dmKeys } from "./dm";
import { NewMessageDialog } from "./new-message-dialog";

type Confirm = null | "delete" | "leave" | "block";

export function ConversationInfo({ c, open, onOpenChange }: { c: Conversation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [title, setTitle] = useState(c.title ?? "");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const other = !c.isGroup ? c.participants[0] : undefined;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: dmKeys.conv(c.id) });
    qc.invalidateQueries({ queryKey: ["dm", "list"] });
    qc.invalidateQueries({ queryKey: dmKeys.unread });
  };
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => { if (ok) toast.success(ok); refresh(); }).catch((e) => toast.error(errorMessage(e)));

  const doConfirm = async () => {
    if (confirm === "delete") await run(() => del(`/conversations/${c.id}`), "Chat deleted");
    if (confirm === "leave") await run(() => post(`/conversations/${c.id}/leave`), "You left the group");
    if (confirm === "block" && other) {
      if (c.blockedByMe) await run(() => del(`/blocks/${other.id}`), `Unblocked ${other.displayName}`);
      else await run(() => post(`/blocks/${other.id}`), `Blocked ${other.displayName}`);
      setConfirm(null);
      return;
    }
    setConfirm(null);
    onOpenChange(false);
    router.push("/messages");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle className="font-sans text-base tracking-normal">Details</SheetTitle>
          </SheetHeader>

          <div className="space-y-1 px-4 py-2">
            <label className="flex items-center justify-between py-2 text-[15px]">
              <span className="flex items-center gap-3"><BellOff className="size-5" /> Mute messages</span>
              <Switch checked={c.muted} onCheckedChange={(v) => run(() => patch(`/conversations/${c.id}`, { muted: v }))} />
            </label>

            {c.isGroup && (
              <form className="flex gap-2 py-2" onSubmit={(e) => { e.preventDefault(); run(() => patch(`/conversations/${c.id}`, { title: title.trim() || null }), "Group renamed"); }}>
                <div className="relative flex-1">
                  <Pencil className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={conversationName({ ...c, title: null })} maxLength={60} className="pl-9" />
                </div>
                <Button type="submit" variant="outline" disabled={title === (c.title ?? "")}>Save</Button>
              </form>
            )}
          </div>

          <div className="border-t px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{c.isGroup ? `Members (${c.memberCount})` : "Member"}</h3>
              {c.isGroup && (
                <Button variant="ghost" size="sm" onClick={() => setAdding(true)}><UserPlus /> Add people</Button>
              )}
            </div>
            <div className="space-y-1">
              {c.participants.map((p) => (
                <Link key={p.id} href={`/profile/${p.username}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60">
                  <UserAvatar src={p.avatarUrl} name={p.displayName} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-sm font-semibold">{p.displayName} {p.isVerified && <VerifiedMark />}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      @{p.username}
                      {p.role === "admin" && c.isGroup ? " · Admin" : ""}
                      {p.deactivated ? " · Unavailable" : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-1 border-t px-2 py-3">
            {other && (
              <button onClick={() => setConfirm("block")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-destructive hover:bg-destructive/10">
                <Ban className="size-5" /> {c.blockedByMe ? "Unblock" : "Block"}
              </button>
            )}
            {c.isGroup && (
              <button onClick={() => setConfirm("leave")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-destructive hover:bg-destructive/10">
                <LogOut className="size-5" /> Leave chat
              </button>
            )}
            <button onClick={() => setConfirm("delete")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-destructive hover:bg-destructive/10">
              <Trash2 className="size-5" /> Delete chat
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <NewMessageDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add people"
        exclude={c.participants.map((p) => p.id)}
        onPick={(users) => run(() => post(`/conversations/${c.id}/members`, { userIds: users.map((u) => u.id) }), "Added to group")}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" && "Delete chat?"}
              {confirm === "leave" && "Leave chat?"}
              {confirm === "block" && (c.blockedByMe ? `Unblock ${other?.displayName}?` : `Block ${other?.displayName}?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete" && "This removes the chat and its history for you only. Other people in the chat will still see it."}
              {confirm === "leave" && "You won't get messages from this group unless someone adds you back."}
              {confirm === "block" && (c.blockedByMe ? "They'll be able to message you again." : "They won't be able to message you. They won't be notified that you blocked them.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={confirm === "block" && c.blockedByMe ? "default" : "destructive"} onClick={doConfirm}>
              {confirm === "delete" ? "Delete" : confirm === "leave" ? "Leave" : c.blockedByMe ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
