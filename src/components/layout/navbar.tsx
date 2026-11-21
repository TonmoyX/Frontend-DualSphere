"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Home, Search, Send, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/common/bits";
import { FeedModeSwitch } from "@/components/post/feed-mode-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { get } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { AccountMenu } from "./account-menu";

export function Navbar() {
  const { user, loading } = useAuth();
  const settings = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => get<{ count: number }>("/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const { data: friendCounts } = useQuery({
    queryKey: ["friends", "counts"],
    queryFn: () => get<{ incoming: number }>("/friends/counts"),
    enabled: !!user,
    refetchInterval: 120_000,
  });
  const { data: dmUnread } = useQuery({
    queryKey: ["dm", "unread"],
    queryFn: () => get<{ primary: number; requests: number }>("/conversations/unread-count"),
    enabled: !!user && settings.features.messagingEnabled,
    refetchInterval: 60_000,
  });

  // Icon-only nav (label in a tooltip + aria-label for screen readers)
  const navLink = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = href === "/" ? pathname === "/feed" || pathname === "/" : pathname.startsWith(href);
    return (
      <Tooltip key={href}>
        <TooltipTrigger asChild>
          <Link
            href={href}
            aria-label={badge ? `${label} (${badge} new)` : label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
            {!!badge && (
              <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[11px] font-bold text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
        <Logo name={settings.site.name} hideName className="shrink-0" />
        <form
          className="relative hidden w-56 shrink-0 sm:block lg:w-60"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DualSphere" className="h-10 rounded-full bg-muted pl-9" aria-label="Search" />
        </form>

        {/* Feed filter — centre of the navbar on desktop */}
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          {/* only on the home feed; hidden on every other page */}
          {user && (pathname === "/" || pathname === "/feed") && (
            <Suspense>
              <FeedModeSwitch layoutId="feed-mode-nav" />
            </Suspense>
          )}
        </div>

        <nav className="ml-auto flex items-center gap-1 sm:gap-1.5 md:ml-0">
          {navLink("/", "Feed", Home)}
          <Link href="/search" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent sm:hidden" aria-label="Search">
            <Search className="size-6" />
          </Link>
          {user && navLink("/friends", "Friends", Users, friendCounts?.incoming)}
          {user && settings.features.messagingEnabled && navLink("/messages", "Messages", Send, (dmUnread?.primary ?? 0) + (dmUnread?.requests ?? 0))}
          {user && navLink("/notifications", "Notifications", Bell, unread?.count)}

          {!loading && !user && (
            <div className="ml-2 flex items-center gap-2">
              <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
              {settings.features.registrationEnabled && <Button asChild size="sm"><Link href="/signup">Sign up</Link></Button>}
            </div>
          )}
          {user && <AccountMenu />}
        </nav>
      </div>
    </header>
  );
}
