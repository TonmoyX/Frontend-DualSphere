"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, TrendingDown, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { EmptyState, Spinner, UserAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/api";
import type { Currency } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface Dashboard {
  balances: { currency: Currency; pending: number; available: number; payoutHold: number }[];
  daily: { date: string; tips: number; memberships: number; unlocks: number }[];
  totals: { members: number; canceling: number; churned30d: number; tips: number; lifetimeNet: number };
  topTippers: { username: string; displayName: string; avatarUrl: string | null; total: number; currency: Currency }[];
  topPosts: { postId: string; snippet: string; earned: number; payments: number; currency: Currency }[];
  currency: Currency;
}

function Stat({ label, value, Icon }: { label: string; value: string; Icon: typeof Users }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function CreatorDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login?next=/creator/dashboard"); }, [loading, user, router]);
  const { data, isLoading, error } = useQuery({ queryKey: ["creator-dashboard", user?.id], queryFn: () => get<Dashboard>("/creators/me/dashboard"), enabled: !!user });
  const max = useMemo(() => Math.max(1, ...(data?.daily ?? []).map((d) => d.tips + d.memberships + d.unlocks)), [data]);

  if (isLoading || !user) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  if (error || !data) return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Turn on creator tools first"><Link href="/creator" className="text-primary hover:underline">Open Creator studio</Link></EmptyState></div>;
  const b = data.balances.find((x) => x.currency === data.currency) ?? { pending: 0, available: 0, payoutHold: 0, currency: data.currency };
  const cur = data.currency;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Creator dashboard</h1>
        <Button variant="secondary" size="sm" asChild><Link href="/creator"><ArrowLeft /> Creator studio</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available" value={formatMoney(b.available, cur)} Icon={Wallet} />
        <Stat label="In refund window" value={formatMoney(b.pending, cur)} Icon={Wallet} />
        <Stat label="Members" value={`${data.totals.members}${data.totals.canceling ? ` (${data.totals.canceling} ending)` : ""}`} Icon={Users} />
        <Stat label="Churned (30 days)" value={String(data.totals.churned30d)} Icon={TrendingDown} />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Earnings · last 30 days</h2>
          <p className="text-sm text-muted-foreground">Lifetime (after fees): <b className="text-foreground">{formatMoney(data.totals.lifetimeNet, cur)}</b></p>
        </div>
        <div className="flex h-44 items-end gap-1" role="img" aria-label="Daily earnings chart">
          {data.daily.map((d) => {
            const total = d.tips + d.memberships + d.unlocks;
            return (
              <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${formatMoney(total, cur)}`}>
                <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${(d.memberships / max) * 100}%` }} />
                <div className="w-full bg-pink-500/80" style={{ height: `${(d.tips / max) * 100}%` }} />
                <div className="w-full bg-amber-500/80" style={{ height: `${(d.unlocks / max) * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" /> Memberships</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-pink-500" /> Tips</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" /> Paid posts</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Heart className="size-5 text-pink-500" /> Top tippers</h2>
          {data.topTippers.length === 0 && <p className="text-sm text-muted-foreground">No tips yet.</p>}
          <ol className="space-y-2">
            {data.topTippers.map((t, i) => (
              <li key={t.username} className="flex items-center gap-3">
                <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                <UserAvatar src={t.avatarUrl} name={t.displayName} className="size-8" />
                <Link href={`/profile/${t.username}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{t.displayName}</Link>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(t.total, t.currency)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-bold">Top earning posts</h2>
          {data.topPosts.length === 0 && <p className="text-sm text-muted-foreground">Post paid content or get tips on posts to see them here.</p>}
          <ul className="space-y-2">
            {data.topPosts.map((p) => (
              <li key={p.postId}>
                <Link href={`/post/${p.postId}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
                  <span className="min-w-0 flex-1 truncate text-sm">{p.snippet || "(media post)"}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(p.earned, p.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
