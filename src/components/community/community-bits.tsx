"use client";

import { Globe, Lock, MailCheck, UsersRound, VenetianMask } from "lucide-react";
import Link from "next/link";
import { compact } from "@/components/common/bits";
import type { AnonPolicy, CommunityListItem, CommunityVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VISIBILITY: Record<CommunityVisibility, { label: string; hint: string; Icon: typeof Globe }> = {
  public: { label: "Public", hint: "Anyone can see posts and join", Icon: Globe },
  private: { label: "Private", hint: "Anyone can find it; members see posts. Joining needs approval", Icon: Lock },
  invite_only: { label: "Invite only", hint: "Hidden from search. Only people with an invite link can join", Icon: MailCheck },
};

export const ANON_POLICY: Record<AnonPolicy, { label: string; hint: string }> = {
  off: { label: "Names only", hint: "Everyone posts as themselves" },
  allowed: { label: "Names or anonymous", hint: "Members choose for each post" },
  anon_only: { label: "Anonymous only", hint: "Confession pages, campus Q&A" },
};

/** Square icon: the uploaded image, or the first letter on a colour derived from the name. */
export function CommunityIcon({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl font-bold text-white", className ?? "size-12 text-lg")}
      style={src ? undefined : { background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 42%))` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}

export function CommunityCard({ c }: { c: CommunityListItem }) {
  const V = VISIBILITY[c.visibility];
  return (
    <Link href={`/c/${c.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40">
      <div
        className="h-20 bg-gradient-to-br from-identity/30 via-primary/20 to-anon/20 bg-cover bg-center"
        style={c.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})` } : undefined}
      />
      <div className="flex flex-1 flex-col px-4 pb-4">
        <CommunityIcon name={c.name} src={c.iconUrl} className="-mt-7 size-14 border-4 border-card text-xl" />
        <div className="mt-2 flex items-center gap-1.5">
          <h3 className="truncate font-semibold group-hover:underline">{c.name}</h3>
          {c.isFeatured && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Featured</span>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <V.Icon className="size-3.5" /> {V.label} · <UsersRound className="size-3.5" /> {compact(c.memberCount)} member{c.memberCount === 1 ? "" : "s"}
          {c.anonPolicy !== "off" && <> · <VenetianMask className="size-3.5" /></>}
        </p>
        {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
        {c.role && (
          <span className="mt-auto pt-3 text-xs font-medium text-primary">
            {c.role === "owner" ? "You own this" : c.role === "mod" ? "You moderate this" : "Joined"}
          </span>
        )}
      </div>
    </Link>
  );
}
