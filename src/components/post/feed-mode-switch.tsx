"use client";

import { motion } from "framer-motion";
import { Layers, UserRound, VenetianMask } from "lucide-react";
import type { ComponentType } from "react";
import { GroupsIcon } from "@/components/common/groups-icon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeedMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const OPTIONS: { v: FeedMode; label: string; hint: string; Icon: IconType; icon: string; tint: string; pill: string }[] = [
  {
    v: "all", label: "Everything", hint: "All posts", Icon: Layers, icon: "text-fuchsia-500", tint: "bg-fuchsia-500/10",
    pill: "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 shadow-sm shadow-fuchsia-500/20",
  },
  {
    v: "identity", label: "Identity", hint: "Posts with a name", Icon: UserRound, icon: "text-blue-500", tint: "bg-blue-500/10",
    pill: "bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20",
  },
  {
    v: "anonymous", label: "Anonymous", hint: "No names attached", Icon: VenetianMask, icon: "text-orange-500", tint: "bg-orange-500/10",
    pill: "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-sm shadow-orange-500/20",
  },
  {
    v: "communities", label: "Communities", hint: "From groups you joined", Icon: GroupsIcon, icon: "text-emerald-500", tint: "bg-emerald-500/10",
    pill: "bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600 shadow-sm shadow-teal-500/20",
  },
];

export function useFeedMode(): FeedMode {
  const m = useSearchParams().get("mode");
  return m === "identity" || m === "anonymous" || m === "communities" ? m : "all";
}

/**
 * Feed filter. `vertical` = the left-hand menu on the feed (large screens);
 * otherwise a segmented pill (under the navbar on smaller screens).
 */
export function FeedModeSwitch({ className, compact = false, vertical = false, layoutId = "feed-mode" }: { className?: string; compact?: boolean; vertical?: boolean; layoutId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useFeedMode();
  const { user } = useAuth();
  // "Communities" shows posts from communities you joined, so it's for signed-in people only
  const options = user ? OPTIONS : OPTIONS.filter((o) => o.v !== "communities");
  const onFeed = pathname === "/" || pathname === "/feed";

  const go = (v: FeedMode) => {
    const base = onFeed ? pathname : "/";
    router.replace(v === "all" ? base : `${base}?mode=${v}`, { scroll: false });
    if (onFeed) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (vertical) {
    return (
      <nav aria-label="Feed filter" className={cn("rounded-2xl border bg-card p-2", className)}>
        <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Feed</p>
        <div role="tablist" aria-orientation="vertical" className="space-y-0.5">
          {options.map((o) => {
            const active = onFeed && mode === o.v;
            return (
              <button
                key={o.v}
                role="tab"
                aria-selected={active}
                onClick={() => go(o.v)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                  active ? "text-white" : "hover:bg-accent",
                )}
              >
                {active && <motion.span layoutId={layoutId} className={cn("absolute inset-0 rounded-xl", o.pill)} transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full", active ? "bg-white/20" : o.tint)}>
                  <o.Icon className={cn("size-5", !active && o.icon)} strokeWidth={active ? 2.4 : 2.1} />
                </span>
                <span className="relative min-w-0">
                  <span className="block text-[15px] font-semibold">{o.label}</span>
                  <span className={cn("block truncate text-xs", active ? "text-white/80" : "text-muted-foreground")}>{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Feed filter"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-black/5 bg-white/70 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:ring-white/5",
        className,
      )}
    >
      {options.map((o) => {
        const active = onFeed && mode === o.v;
        return (
          <button
            key={o.v}
            role="tab"
            aria-selected={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => go(o.v)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
              compact ? "px-3 py-2" : "px-3.5 py-1.5 text-sm",
              active ? "text-white" : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
            )}
          >
            {active && <motion.span layoutId={layoutId} className={cn("absolute inset-0 rounded-full", o.pill)} transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <o.Icon className={cn("relative transition-colors", compact ? "size-5" : "size-4", !active && o.icon)} strokeWidth={active ? 2.5 : 2.2} />
            {/* Mobile (compact): icons only — the name stays for screen readers and as a tooltip */}
            <span className={compact ? "sr-only" : "relative"}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
