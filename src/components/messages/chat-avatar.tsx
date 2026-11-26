"use client";

import { UserAvatar } from "@/components/common/bits";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Single avatar with an online dot, or two stacked avatars for groups. */
export function ConversationAvatar({ c, size = 56 }: { c: Conversation; size?: number }) {
  const online = c.participants.some((p) => p.online);
  const dot = Math.max(12, Math.round(size * 0.24));
  if (c.isGroup && c.avatarUrl) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <UserAvatar src={c.avatarUrl} name={c.title ?? "Group"} className="size-full" />
        {online && <span className="absolute right-0 bottom-0 rounded-full border-2 border-background bg-green-500" style={{ width: dot, height: dot }} />}
      </div>
    );
  }
  if (c.isGroup && c.participants.length > 1) {
    const [a, b] = c.participants;
    const s = Math.round(size * 0.72);
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <UserAvatar src={b.avatarUrl} name={b.displayName} className="absolute top-0 right-0" style={{ width: s, height: s }} />
        <UserAvatar src={a.avatarUrl} name={a.displayName} className="absolute bottom-0 left-0 ring-2 ring-background" style={{ width: s, height: s }} />
        {online && <span className="absolute right-0 bottom-0 rounded-full border-2 border-background bg-green-500" style={{ width: dot, height: dot }} />}
      </div>
    );
  }
  const p = c.participants[0];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <UserAvatar src={p?.avatarUrl} name={p?.displayName ?? "?"} className="size-full" />
      {online && <span className={cn("absolute right-0 bottom-0 rounded-full border-2 border-background bg-green-500")} style={{ width: dot, height: dot }} />}
    </div>
  );
}
