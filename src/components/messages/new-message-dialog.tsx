"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage, get, post } from "@/lib/api";
import type { Conversation, PublicUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** People picker. With `onPick` it returns users (add to group); otherwise it starts a chat. */
export function NewMessageDialog({
  open,
  onOpenChange,
  onPick,
  exclude = [],
  title = "New message",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick?: (users: PublicUser[]) => Promise<unknown> | void;
  exclude?: string[];
  title?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PublicUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const term = useDebounced(q.trim());

  const { data, isFetching } = useQuery({
    queryKey: ["user-search", term],
    queryFn: () => get<{ users: PublicUser[] }>(`/users?q=${encodeURIComponent(term)}`),
    enabled: open && term.length > 0,
  });
  const results = (data?.users ?? []).filter((u) => u.id !== user?.id && !exclude.includes(u.id));

  const reset = () => { setQ(""); setPicked([]); setGroupName(""); };
  const toggle = (u: PublicUser) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  const start = useMutation({
    mutationFn: async () => {
      if (onPick) return onPick(picked);
      const r = await post<{ conversation: Conversation }>("/conversations", {
        userIds: picked.map((p) => p.id),
        title: picked.length > 1 && groupName.trim() ? groupName.trim() : undefined,
      });
      router.push(`/messages/${r.conversation.id}`);
    },
    onSuccess: () => { onOpenChange(false); reset(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-center font-sans text-base font-semibold tracking-normal">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
          <span className="font-semibold">To:</span>
          {picked.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-sm font-medium text-primary">
              {p.displayName}
              <button onClick={() => toggle(p)} aria-label={`Remove ${p.displayName}`} className="rounded-full p-0.5 hover:bg-primary/20"><X className="size-3.5" /></button>
            </span>
          ))}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="min-w-24 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {picked.length > 1 && !onPick && (
          <div className="border-b px-4 py-2.5">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={60} placeholder="Group name (optional)" className="h-9" />
          </div>
        )}
        <div className="h-80 overflow-y-auto">
          {!term && <p className="px-4 py-8 text-center text-sm text-muted-foreground"><Search className="mx-auto mb-2 size-6" />Search for people by name or username.</p>}
          {term && isFetching && <Spinner className="mx-auto my-6 block" />}
          {term && !isFetching && results.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No account found.</p>}
          {results.map((u) => {
            const on = picked.some((p) => p.id === u.id);
            return (
              <button key={u.id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/60">
                <UserAvatar src={u.avatarUrl} name={u.displayName} className="size-11" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-sm font-semibold">{u.displayName} {u.isVerified && <VerifiedMark />}</div>
                  <div className="truncate text-sm text-muted-foreground">@{u.username}</div>
                </div>
                <span className={cn("grid size-6 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t p-3">
          <Button className="h-10 w-full rounded-lg font-semibold" disabled={!picked.length || start.isPending} onClick={() => start.mutate()}>
            {start.isPending && <Spinner />} {onPick ? "Add" : picked.length > 1 ? "Create group chat" : "Chat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
