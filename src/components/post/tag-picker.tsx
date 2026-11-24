"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Spinner, UserAvatar } from "@/components/common/bits";
import { get } from "@/lib/api";
import type { FriendCard, PostTag } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_TAGS = 20;

/** Search your friends and tag them (Facebook-style "Tag people"). Only friends can be tagged. */
export function TagPicker({ value, onChange, onDone }: { value: PostTag[]; onChange: (t: PostTag[]) => void; onDone?: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const friends = useQuery({
    queryKey: ["friends", "tag-search", debounced],
    queryFn: async () => (await get<{ friends: FriendCard[] }>(`/friends${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`)).friends,
    staleTime: 30_000,
  });

  const selected = new Set(value.map((t) => t.id));
  const toggle = (f: FriendCard) =>
    onChange(selected.has(f.id) ? value.filter((t) => t.id !== f.id) : value.length >= MAX_TAGS ? value : [...value, { id: f.id, username: f.username, displayName: f.displayName }]);

  return (
    <div className="rounded-xl border bg-background/40">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search friends"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
        {onDone && (
          <button type="button" onClick={onDone} className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
            Done
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
          {value.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary">
              {t.displayName}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== t.id))} className="grid size-4 place-items-center rounded-full hover:bg-primary/20" aria-label={`Remove ${t.displayName}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1">
        {friends.isLoading ? (
          <div className="grid place-items-center py-6"><Spinner /></div>
        ) : !friends.data?.length ? (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">{debounced ? "No friends match that name" : "You can tag your friends here — add some friends first"}</p>
        ) : (
          friends.data.map((f) => {
            const on = selected.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f)}
                disabled={!on && value.length >= MAX_TAGS}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-40", on && "bg-primary/5")}
              >
                <UserAvatar src={f.avatarUrl} name={f.displayName} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{f.username}</span>
                </span>
                {on && <Check className="size-4 text-primary" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** "with Rahim", "with Rahim and Karim", "with Rahim and 3 others" — names link to profiles. */
export function TaggedLine({ tags, linked = true, className }: { tags: PostTag[]; linked?: boolean; className?: string }) {
  if (!tags.length) return null;
  const shown = tags.length <= 2 ? tags : tags.slice(0, 1);
  const rest = tags.length - shown.length;
  const name = (t: PostTag) =>
    linked ? (
      <Link href={`/profile/${t.username}`} className="font-semibold text-foreground hover:underline">{t.displayName}</Link>
    ) : (
      <span className="font-semibold text-foreground">{t.displayName}</span>
    );
  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      with{" "}
      {shown.map((t, i) => (
        <Fragment key={t.id}>
          {i > 0 && " and "}
          {name(t)}
        </Fragment>
      ))}
      {rest > 0 && (
        <>
          {" and "}
          <span className="font-semibold text-foreground" title={tags.slice(shown.length).map((t) => t.displayName).join(", ")}>
            {rest} other{rest > 1 ? "s" : ""}
          </span>
        </>
      )}
    </span>
  );
}
