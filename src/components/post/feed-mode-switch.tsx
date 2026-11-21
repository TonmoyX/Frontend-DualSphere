"use client";

import { motion } from "framer-motion";
import { Layers, UserRound, VenetianMask } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeedMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { v: FeedMode; label: string; Icon: typeof Layers; icon: string; pill: string }[] = [
  {
    v: "all", label: "Everything", Icon: Layers, icon: "text-fuchsia-500",
    pill: "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 shadow-sm shadow-fuchsia-500/20",
  },
  {
    v: "identity", label: "Identity", Icon: UserRound, icon: "text-blue-500",
    pill: "bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20",
  },
  {
    v: "anonymous", label: "Anonymous", Icon: VenetianMask, icon: "text-orange-500",
    pill: "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-sm shadow-orange-500/20",
  },
];

export function useFeedMode(): FeedMode {
  const m = useSearchParams().get("mode");
  return m === "identity" || m === "anonymous" ? m : "all";
}

/** Feed filter as an eye-catching segmented pill (lives in the navbar on desktop). */
export function FeedModeSwitch({ className, compact = false, layoutId = "feed-mode" }: { className?: string; compact?: boolean; layoutId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useFeedMode();
  const onFeed = pathname === "/" || pathname === "/feed";

  const go = (v: FeedMode) => {
    const base = onFeed ? pathname : "/";
    router.replace(v === "all" ? base : `${base}?mode=${v}`, { scroll: false });
    if (onFeed) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      role="tablist"
      aria-label="Feed filter"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-black/5 bg-white/70 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:ring-white/5",
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = onFeed && mode === o.v;
        return (
          <button
            key={o.v}
            role="tab"
            aria-selected={active}
            onClick={() => go(o.v)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
              compact ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-1.5 text-sm",
              active ? "text-white" : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
            )}
          >
            {active && <motion.span layoutId={layoutId} className={cn("absolute inset-0 rounded-full", o.pill)} transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <o.Icon className={cn("relative size-4 transition-colors", !active && o.icon)} strokeWidth={active ? 2.5 : 2.2} />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
