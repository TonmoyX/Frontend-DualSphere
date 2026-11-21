"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, UserCheck, UserMinus, UserPlus, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { del, errorMessage, post } from "@/lib/api";
import type { FriendStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Refresh everything that shows friendship state. */
export function useFriendInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["dm"] });
  };
}

/**
 * Facebook-style friend action. Optimistic: the button flips immediately,
 * then reconciles with the server.
 *  none     → [Add friend]
 *  outgoing → [Cancel request]
 *  incoming → [Confirm] [Delete]
 *  friends  → [Friends ▾ Unfriend]
 */
export function FriendButton({
  userId,
  name,
  status: initial,
  size = "sm",
  block = false,
  className,
}: {
  userId: string;
  name: string;
  status: FriendStatus;
  size?: "sm" | "default";
  block?: boolean;
  className?: string;
}) {
  const invalidate = useFriendInvalidate();
  const [status, setStatus] = useState<FriendStatus>(initial);
  const [synced, setSynced] = useState(initial);
  // Follow server updates (e.g. the other person accepted while we're looking)
  if (initial !== synced) {
    setSynced(initial);
    setStatus(initial);
  }

  const m = useMutation({
    mutationFn: async (action: "add" | "cancel" | "accept" | "decline" | "unfriend") => {
      const map = {
        add: () => post<{ status: FriendStatus }>(`/friends/requests/${userId}`),
        cancel: () => del<{ status: FriendStatus }>(`/friends/requests/${userId}`),
        accept: () => post<{ status: FriendStatus }>(`/friends/requests/${userId}/accept`),
        decline: () => post<{ status: FriendStatus }>(`/friends/requests/${userId}/decline`),
        unfriend: () => del<{ status: FriendStatus }>(`/friends/${userId}`),
      };
      return map[action]();
    },
    onMutate: (action) => {
      const prev = status;
      setStatus(action === "add" ? "outgoing" : action === "accept" ? "friends" : "none");
      return { prev };
    },
    onSuccess: (r, action) => {
      setStatus(r.status);
      if (action === "accept" || r.status === "friends") toast.success(`You and ${name} are now friends`);
      invalidate();
    },
    onError: (e, _a, ctx) => {
      if (ctx) setStatus(ctx.prev);
      toast.error(errorMessage(e));
    },
  });

  const cls = cn(block && "flex-1", "font-semibold", className);
  if (status === "self") return null;

  if (status === "incoming") {
    return (
      <div className={cn("flex gap-2", block && "w-full")}>
        <Button size={size} className={cls} onClick={() => m.mutate("accept")} disabled={m.isPending}>
          {m.isPending ? <Spinner /> : <Check />} Confirm
        </Button>
        <Button size={size} variant="secondary" className={cls} onClick={() => m.mutate("decline")} disabled={m.isPending}>
          Delete
        </Button>
      </div>
    );
  }

  if (status === "friends") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant="secondary" className={cls}><UserCheck /> Friends</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => m.mutate("unfriend")}>
            <UserX /> Unfriend
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (status === "outgoing") {
    return (
      <Button size={size} variant="secondary" className={cls} onClick={() => m.mutate("cancel")} disabled={m.isPending}>
        <UserMinus /> Cancel request
      </Button>
    );
  }

  return (
    <Button size={size} className={cls} onClick={() => m.mutate("add")} disabled={m.isPending}>
      <UserPlus /> Add friend
    </Button>
  );
}
