"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { BadgeCheck, Loader2, ShieldCheck, VenetianMask } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

/** Accretion-disk ring: a swirling conic gradient, squashed into a tilted ellipse (rendered twice: behind and in front of the core). */
function Disk({ front = false }: { front?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("absolute top-1/2 left-1/2 h-[160%] w-[160%]", front && "z-[2]")}
      // tilt + flatten; the front copy only shows the lower half so the disk wraps around the hole
      style={{ transform: "translate(-50%,-50%) rotate(-12deg) scaleY(0.24)", clipPath: front ? "inset(50% 0 0 0)" : undefined }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 250deg, #fff7e0, #fdba74 12%, #f97316 25%, #7c2d12 45%, #c2410c 60%, #fb923c 75%, #fde68a 90%, #fff7e0)",
          mask: "radial-gradient(circle, transparent 30%, #000 33%, #000 52%, transparent 68%)",
          WebkitMask: "radial-gradient(circle, transparent 30%, #000 33%, #000 52%, transparent 68%)",
        }}
      />
    </span>
  );
}

/**
 * DualSphere mark: a black hole — a dark event horizon, a thin glowing photon ring,
 * a lensed halo and a swirling accretion disk wrapping around it.
 * Static mark (no animation). `hideName` shows the icon alone (navbar); the name stays for screen readers.
 */
export function Logo({ name = "DualSphere", className, hideName = false }: { name?: string; className?: string; hideName?: boolean }) {
  const split = /^(.+?)([A-Z][a-z]+)$/.exec(name); // "DualSphere" → "Dual" + glowing "Sphere"
  return (
    <Link href="/" aria-label={`${name} home`} className={cn("group flex items-center gap-2.5 font-heading text-lg font-bold", className)}>
      <span className="ds-logo relative mx-1.5 grid size-9 shrink-0 place-items-center">
        {/* warm glow */}
        <span aria-hidden className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.55)_0%,rgba(234,88,12,0.25)_40%,transparent_70%)] opacity-70 blur-[6px]" />
        <Disk />
        {/* lensed halo (light bent over the top and bottom of the hole) */}
        <span
          aria-hidden
          className="absolute inset-[21%] rounded-full blur-[0.5px]"
          style={{
            background: "conic-gradient(from 300deg, #fff7e0, #fdba74, #ea580c, #431407, #ea580c, #fdba74, #fff7e0)", // bright over the top-left
            mask: "radial-gradient(circle, transparent 76%, #000 82%, #000 90%, transparent 100%)",
            WebkitMask: "radial-gradient(circle, transparent 76%, #000 82%, #000 90%, transparent 100%)",
          }}
        />
        {/* event horizon + photon ring */}
        <span aria-hidden className="relative z-[1] size-[46%] rounded-full bg-black shadow-[0_0_0_0.75px_rgba(255,247,224,0.95),0_0_5px_1px_rgba(253,186,116,0.85),inset_0_0_6px_rgba(0,0,0,1)]" />
        <Disk front />
      </span>
      {hideName ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span>
          {split ? split[1] : name}
          {split && <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">{split[2]}</span>}
        </span>
      )}
    </Link>
  );
}

export function UserAvatar({ src, name, className, style }: { src?: string | null; name: string; className?: string; style?: React.CSSProperties }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Avatar className={cn("size-10", className)} style={style}>
      {src ? <AvatarImage src={src} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="bg-identity/15 font-medium text-identity">{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}

/** Anonymous posts get a generic mask avatar — never derived from the author. */
export function AnonAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-10 shrink-0 place-items-center rounded-full border border-anon/25 bg-anon/10 text-anon", className)}>
      <VenetianMask className="size-5" />
    </div>
  );
}

export function VerifiedMark() {
  return <BadgeCheck className="size-4 text-identity" aria-label="Verified" />;
}

export function RoleBadge({ role }: { role: Role }) {
  if (role === "user") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning">
      <ShieldCheck className="size-3" />
      {role === "admin" ? "Admin" : "Mod"}
    </span>
  );
}

export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const d = new Date(date);
  return (
    <time dateTime={date} title={d.toLocaleString()} className={cn("text-xs text-muted-foreground", className)}>
      {formatDistanceToNowStrict(d, { addSuffix: false })}
    </time>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-heading text-base font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}
