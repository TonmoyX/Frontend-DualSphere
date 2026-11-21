"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Search, Send, UserCheck, UserPlus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmptyState, Spinner } from "@/components/common/bits";
import { FriendCardItem } from "@/components/friends/friend-card";
import { get, post } from "@/lib/api";
import type { FriendCard, FriendStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type Tab = "home" | "requests" | "suggestions" | "all" | "sent";

function Grid({ items, status, onDismiss }: { items: FriendCard[]; status: FriendStatus; onDismiss?: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <AnimatePresence initial={false}>
        {items.map((u) => <FriendCardItem key={u.id} u={u} status={status} onDismiss={onDismiss ? () => onDismiss(u.id) : undefined} />)}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-sans text-xl font-bold tracking-normal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FriendsInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const tab = (params.get("tab") as Tab) || "home";
  const setTab = (t: Tab) => router.replace(t === "home" ? "/friends" : `/friends?tab=${t}`, { scroll: false });
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/friends");
  }, [loading, user, router]);

  const counts = useQuery({ queryKey: ["friends", "counts"], queryFn: () => get<{ friends: number; incoming: number; outgoing: number }>("/friends/counts"), enabled: !!user });
  const requests = useQuery({ queryKey: ["friends", "requests"], queryFn: async () => (await get<{ requests: FriendCard[] }>("/friends/requests")).requests, enabled: !!user });
  const suggestions = useQuery({ queryKey: ["friends", "suggestions"], queryFn: async () => (await get<{ suggestions: FriendCard[] }>("/friends/suggestions?limit=30")).suggestions, enabled: !!user && (tab === "home" || tab === "suggestions") });
  const all = useQuery({ queryKey: ["friends", "all", q], queryFn: async () => (await get<{ friends: FriendCard[] }>(`/friends${q ? `?q=${encodeURIComponent(q)}` : ""}`)).friends, enabled: !!user && tab === "all" });
  const sent = useQuery({ queryKey: ["friends", "sent"], queryFn: async () => (await get<{ requests: FriendCard[] }>("/friends/requests/sent")).requests, enabled: !!user && tab === "sent" });

  const dismiss = useMutation({
    mutationFn: (id: string) => post(`/friends/suggestions/${id}/dismiss`),
    onMutate: (id) => qc.setQueryData<FriendCard[]>(["friends", "suggestions"], (l) => l?.filter((u) => u.id !== id)),
  });

  if (!user) return <div className="grid min-h-[60vh] place-items-center"><Spinner className="size-6" /></div>;

  const nav: { t: Tab; label: string; Icon: typeof Users; badge?: number }[] = [
    { t: "home", label: "Home", Icon: Users },
    { t: "requests", label: "Friend requests", Icon: UserPlus, badge: counts.data?.incoming },
    { t: "suggestions", label: "Suggestions", Icon: UserPlus },
    { t: "all", label: "All friends", Icon: UserCheck, badge: undefined },
    { t: "sent", label: "Sent requests", Icon: Send },
  ];

  const reqList = requests.data ?? [];
  const sugList = suggestions.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
      {/* Sidebar (desktop) / scrollable tabs (mobile) */}
      <aside className="shrink-0 border-b md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-72 md:border-r md:border-b-0">
        <h1 className="hidden px-4 pt-5 pb-3 font-sans text-2xl font-bold tracking-normal md:block">Friends</h1>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:flex-col md:overflow-visible md:py-0">
          {nav.map((n) => (
            <button
              key={n.t}
              onClick={() => setTab(n.t)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:py-2.5 md:text-[15px]",
                tab === n.t ? "bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              <span className={cn("hidden size-9 place-items-center rounded-full md:grid", tab === n.t ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <n.Icon className="size-5" />
              </span>
              <span className="md:flex-1 md:text-left">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">{n.badge}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-8">
        {(tab === "home" || tab === "requests") && (
          <Section title="Friend requests" action={tab === "home" && reqList.length > 0 && <button onClick={() => setTab("requests")} className="text-sm text-primary hover:underline">See all</button>}>
            {requests.isLoading && <Spinner />}
            {!requests.isLoading && reqList.length === 0 && (
              <p className="text-sm text-muted-foreground">No new friend requests.</p>
            )}
            <Grid items={tab === "home" ? reqList.slice(0, 10) : reqList} status="incoming" />
          </Section>
        )}

        {(tab === "home" || tab === "suggestions") && (
          <Section title="People you may know">
            {suggestions.isLoading && <Spinner />}
            {!suggestions.isLoading && sugList.length === 0 && <p className="text-sm text-muted-foreground">No suggestions right now. Check back later.</p>}
            <Grid items={sugList} status="none" onDismiss={(id) => dismiss.mutate(id)} />
          </Section>
        )}

        {tab === "all" && (
          <Section title={`All friends${counts.data ? ` (${counts.data.friends})` : ""}`}>
            <div className="relative mb-4 max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" className="h-10 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {all.isLoading && <Spinner />}
            {all.data?.length === 0 && (
              <EmptyState icon={<Users className="size-8" />} title={q ? "No friends match" : "No friends yet"}>
                {!q && <>Find people in <button onClick={() => setTab("suggestions")} className="text-primary hover:underline">Suggestions</button>.</>}
              </EmptyState>
            )}
            <Grid items={all.data ?? []} status="friends" />
          </Section>
        )}

        {tab === "sent" && (
          <Section title="Sent requests">
            {sent.isLoading && <Spinner />}
            {sent.data?.length === 0 && <p className="text-sm text-muted-foreground">You haven&apos;t sent any requests.</p>}
            <Grid items={sent.data ?? []} status="outgoing" />
          </Section>
        )}
      </main>
    </div>
  );
}

export default function FriendsPage() {
  return <Suspense><FriendsInner /></Suspense>;
}
