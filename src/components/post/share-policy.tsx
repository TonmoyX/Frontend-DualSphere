"use client";

import { Ban, Check, ChevronDown, Globe2, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SharePolicy, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SHARE_POLICIES: { v: SharePolicy; label: string; hint: string; Icon: typeof Globe2 }[] = [
  { v: "everyone", label: "Everyone", hint: "Anyone can share this post", Icon: Globe2 },
  { v: "friends", label: "Friends", hint: "Only your friends can share it", Icon: Users },
  { v: "none", label: "No one", hint: "Sharing is turned off", Icon: Ban },
];

/** "Friends" would reveal a hidden author's friend list, so anonymous posts only get Everyone / No one. */
export const policiesFor = (mode: Visibility) => SHARE_POLICIES.filter((p) => mode === "identity" || p.v !== "friends");

export const policyMeta = (v: SharePolicy | undefined) => SHARE_POLICIES.find((p) => p.v === (v ?? "everyone"))!;

/** Composer pill: "Share: Everyone ▾" */
export function SharePolicyPicker({ value, onChange, mode }: { value: SharePolicy; onChange: (v: SharePolicy) => void; mode: Visibility }) {
  const cur = policyMeta(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-accent"
        aria-label="Who can share this post"
      >
        <cur.Icon className="size-3.5" /> Share: {cur.label} <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">Who can share your post?</p>
        {policiesFor(mode).map((p) => (
          <DropdownMenuItem key={p.v} onClick={() => onChange(p.v)} className="items-start gap-3 py-2">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-black/[0.06] dark:bg-white/10")}><p.Icon className="size-4" /></span>
            <span className="flex-1">
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </span>
            {value === p.v && <Check className="mt-1 size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
