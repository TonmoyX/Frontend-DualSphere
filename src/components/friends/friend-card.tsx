"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/common/bits";
import type { FriendCard as FriendCardT, FriendStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FriendButton } from "./friend-button";

/** "3 mutual friends" with a small avatar stack. */
export function MutualLine({ count, preview, className }: { count: number; preview: { id: string; displayName: string; avatarUrl: string | null }[]; className?: string }) {
  if (!count) return null;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <div className="flex -space-x-1.5">
        {preview.slice(0, 3).map((p) => (
          <UserAvatar key={p.id} src={p.avatarUrl} name={p.displayName} className="size-4 text-[7px] ring-2 ring-card" />
        ))}
      </div>
      <span>{count} mutual friend{count > 1 ? "s" : ""}</span>
    </div>
  );
}

/** Facebook-style grid card: big photo, name, mutual friends, actions. */
export function FriendCardItem({ u, status, onDismiss }: { u: FriendCardT; status: FriendStatus; onDismiss?: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative flex flex-col overflow-hidden rounded-xl border bg-card">
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Remove suggestion">
          <X className="size-4" />
        </button>
      )}
      <Link href={`/profile/${u.username}`} className="block aspect-square bg-muted">
        {u.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatarUrl} alt={u.displayName} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-identity/25 to-anon/20 font-heading text-4xl font-bold text-identity">
            {u.displayName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/profile/${u.username}`} className="truncate font-semibold hover:underline">{u.displayName}</Link>
        <MutualLine count={u.mutualCount} preview={u.mutualPreview} className="min-h-4" />
        <div className="mt-auto pt-2">
          <FriendButton userId={u.id} name={u.displayName} status={status} block className="w-full" />
        </div>
      </div>
    </motion.div>
  );
}

/** Compact row used in sidebars. */
export function FriendRow({ u, status }: { u: FriendCardT; status: FriendStatus }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/profile/${u.username}`}><UserAvatar src={u.avatarUrl} name={u.displayName} className="size-11" /></Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${u.username}`} className="block truncate text-sm font-semibold hover:underline">{u.displayName}</Link>
        {u.mutualCount ? <MutualLine count={u.mutualCount} preview={u.mutualPreview} /> : <p className="truncate text-xs text-muted-foreground">@{u.username}</p>}
        <div className="mt-1.5"><FriendButton userId={u.id} name={u.displayName} status={status} size="sm" className="h-7 px-2.5 text-xs" /></div>
      </div>
    </div>
  );
}
