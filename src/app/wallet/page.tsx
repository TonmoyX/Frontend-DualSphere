"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Banknote, Megaphone, Plus, ShieldCheck, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner, TimeAgo } from "@/components/common/bits";
import { TopUpDialog } from "@/components/money/pay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { del, errorMessage, get, post } from "@/lib/api";
import type { Currency } from "@/lib/types";
import { cn, formatMoney, toMinor } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface WalletData {
  balances: { currency: Currency; pending: number; available: number; payoutHold: number }[];
  history: { id: number; account: string; amountMinor: number; currency: Currency; kind: string; createdAt: string; note: string | null }[];
  adAccounts: { businessId: string; name: string; slug: string; balanceMinor: number; currency: Currency | null }[];
  holdDays: number;
  feeBps: number;
}
interface Method { id: string; type: string; label: string; isDefault: boolean }
interface Payout { id: string; amountMinor: number; currency: Currency; status: string; createdAt: string; methodLabel: string; rejectReason: string | null; providerRef: string | null; holdReason: string | null }

const KIND: Record<string, string> = {
  tip: "Tip received", unlock: "Paid post unlocked", membership: "Membership payment", release: "Released from refund window",
  payout_request: "Payout requested", payout_paid: "Payout sent", payout_rejected: "Payout returned", refund: "Refund",
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export default function WalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) router.replace("/login?next=/wallet"); }, [loading, user, router]);

  const wallet = useQuery({ queryKey: ["wallet", user?.id], queryFn: () => get<WalletData>("/wallet"), enabled: !!user });
  const methods = useQuery({ queryKey: ["payout-methods", user?.id], queryFn: () => get<{ methods: Method[] }>("/wallet/methods"), enabled: !!user });
  const payouts = useQuery({ queryKey: ["payouts", user?.id], queryFn: () => get<{ payouts: Payout[]; minMinor: number }>("/wallet/payouts"), enabled: !!user });
  const kyc = useQuery({ queryKey: ["kyc", user?.id], queryFn: () => get<{ kyc: { legalName: string; idType: string; idLast4: string; status: string; notes: string | null } | null }>("/wallet/kyc"), enabled: !!user });

  const [topUp, setTopUp] = useState<WalletData["adAccounts"][number] | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [m, setM] = useState({ accountNumber: "", accountName: "", bankName: "", swift: "", routingNumber: "", country: "" });
  const [k, setK] = useState({ legalName: "", idType: "nid", idNumber: "" });
  const [withdraw, setWithdraw] = useState({ amount: "", methodId: "" });

  const refresh = () => { ["wallet", "payout-methods", "payouts", "kyc"].forEach((key) => qc.invalidateQueries({ queryKey: [key] })); };
  const addMethod = useMutation({
    mutationFn: () => post("/wallet/methods", {
      type: "bank", accountNumber: m.accountNumber, accountName: m.accountName, bankName: m.bankName,
      ...(m.swift ? { swift: m.swift } : {}), ...(m.routingNumber ? { routingNumber: m.routingNumber } : {}), ...(m.country ? { country: m.country } : {}),
    }),
    onSuccess: () => { toast.success("Bank account saved"); setMethodOpen(false); setM({ accountNumber: "", accountName: "", bankName: "", swift: "", routingNumber: "", country: "" }); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeMethod = useMutation({ mutationFn: (id: string) => del(`/wallet/methods/${id}`), onSuccess: () => { toast.success("Removed"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const submitKyc = useMutation({ mutationFn: () => post("/wallet/kyc", k), onSuccess: () => { toast.success("Submitted — staff will review it"); setK({ legalName: "", idType: "nid", idNumber: "" }); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const requestPayout = useMutation({
    mutationFn: (currency: Currency) => post("/wallet/payouts", { methodId: withdraw.methodId || methods.data?.methods[0]?.id, amountMinor: toMinor(withdraw.amount), currency }),
    onSuccess: () => { toast.success("Payout requested"); setWithdraw({ amount: "", methodId: "" }); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user || wallet.isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  const w = wallet.data!;
  const main = w.balances.find((b) => b.currency === "USD") ?? { currency: "USD" as Currency, pending: 0, available: 0, payoutHold: 0 };
  const kycStatus = kyc.data?.kyc?.status ?? "none";

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="size-6 text-primary" /> Wallet</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Available</p><p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(main.available, main.currency)}</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground uppercase">In refund window</p><p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(main.pending, main.currency)}</p><p className="text-xs text-muted-foreground">Unlocks after {w.holdDays} days</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Payout in progress</p><p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(main.payoutHold, main.currency)}</p></div>
      </div>

      <Section title="Withdraw">
        {kycStatus !== "verified" ? (
          <p className="text-sm text-muted-foreground">Verify your identity below before your first payout.</p>
        ) : !methods.data?.methods.length ? (
          <p className="text-sm text-muted-foreground">Add a bank account first.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label htmlFor="w-amt" className="text-xs">Amount</Label><Input id="w-amt" inputMode="decimal" value={withdraw.amount} onChange={(e) => setWithdraw((x) => ({ ...x, amount: e.target.value }))} placeholder={String(main.available / 100)} className="w-36" /></div>
            <div className="space-y-1">
              <Label htmlFor="w-m" className="text-xs">To</Label>
              <select id="w-m" value={withdraw.methodId} onChange={(e) => setWithdraw((x) => ({ ...x, methodId: e.target.value }))} className="h-9 rounded-lg border bg-transparent px-2 text-sm">
                {methods.data.methods.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <Button onClick={() => requestPayout.mutate(main.currency)} disabled={requestPayout.isPending || !Number.isFinite(toMinor(withdraw.amount))}>{requestPayout.isPending && <Spinner />} Request payout</Button>
            <p className="w-full text-xs text-muted-foreground">Minimum {formatMoney(payouts.data?.minMinor ?? 50000, main.currency)}. Staff review every payout; you&apos;ll get a notification when it&apos;s sent.</p>
          </div>
        )}
        {!!payouts.data?.payouts.length && (
          <ul className="mt-4 divide-y text-sm">
            {payouts.data.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <Banknote className="size-4 text-muted-foreground" />
                <span className="font-medium tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
                <span className="text-muted-foreground">→ {p.methodLabel}</span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold capitalize", p.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : p.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted")}>{p.status.replace("_", " ")}</span>
                {p.rejectReason && <span className="text-xs text-muted-foreground">{p.rejectReason}</span>}
                {p.holdReason && <span className="text-xs text-amber-600">On hold: {p.holdReason}</span>}
                <span className="ml-auto text-xs text-muted-foreground"><TimeAgo date={p.createdAt} /></span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Bank accounts" action={<Button size="sm" variant="secondary" onClick={() => setMethodOpen(true)}><Plus /> Add</Button>}>
          {methods.data?.methods.length === 0 && <p className="text-sm text-muted-foreground">No bank account yet. Payouts are sent in US dollars by bank transfer.</p>}
          <ul className="space-y-2">
            {methods.data?.methods.map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="flex-1">{x.label}</span>
                <button type="button" onClick={() => removeMethod.mutate(x.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label={`Remove ${x.label}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Account numbers are encrypted. You only ever see the last 4 digits.</p>
        </Section>

        <Section title="Identity check">
          {kycStatus === "verified" && <p className="flex items-center gap-2 text-sm text-emerald-600"><ShieldCheck className="size-4" /> Verified · {kyc.data?.kyc?.legalName} (•••• {kyc.data?.kyc?.idLast4})</p>}
          {kycStatus === "pending" && <p className="text-sm text-muted-foreground">Submitted. Staff usually review within a few days.</p>}
          {kycStatus === "on_hold" && <p className="text-sm text-amber-600">On hold for extra review{kyc.data?.kyc?.notes ? `: ${kyc.data.kyc.notes}` : ""}. Payouts are paused until it&apos;s released.</p>}
          {kycStatus === "suspended" && <p className="text-sm text-destructive">Your verification is suspended{kyc.data?.kyc?.notes ? `: ${kyc.data.kyc.notes}` : ""}. Contact support.</p>}
          {(kycStatus === "none" || kycStatus === "rejected") && (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submitKyc.mutate(); }}>
              {kycStatus === "rejected" && <p className="rounded-md bg-destructive/10 px-2 py-1 text-sm text-destructive">Not approved: {kyc.data?.kyc?.notes}</p>}
              <Input value={k.legalName} onChange={(e) => setK((x) => ({ ...x, legalName: e.target.value }))} placeholder="Full legal name (as on your ID)" maxLength={100} />
              <div className="flex gap-2">
                <select value={k.idType} onChange={(e) => setK((x) => ({ ...x, idType: e.target.value }))} className="h-9 rounded-lg border bg-transparent px-2 text-sm">
                  <option value="nid">National ID</option><option value="passport">Passport</option><option value="driving_license">Driving licence</option>
                </select>
                <Input value={k.idNumber} onChange={(e) => setK((x) => ({ ...x, idNumber: e.target.value }))} placeholder="ID number" maxLength={30} autoComplete="off" />
              </div>
              <Button size="sm" disabled={submitKyc.isPending || k.legalName.trim().length < 3 || k.idNumber.trim().length < 6}>{submitKyc.isPending && <Spinner />} Submit for review</Button>
              <p className="text-xs text-muted-foreground">Your ID number is encrypted. Only finance staff can see it, and every view is logged.</p>
            </form>
          )}
        </Section>
      </div>

      {w.adAccounts.length > 0 && (
        <Section title="Ad balances" action={<Button size="sm" variant="secondary" asChild><Link href="/ads"><Megaphone /> Ads Manager</Link></Button>}>
          <ul className="space-y-2">
            {w.adAccounts.map((a) => (
              <li key={a.businessId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                <span className="tabular-nums">{formatMoney(a.balanceMinor, "USD")}</span>
                <Button size="sm" onClick={() => setTopUp(a)}><Plus /> Add funds</Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="History">
        {w.history.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
        <ul className="divide-y text-sm">
          {w.history.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2">
              {h.amountMinor >= 0 ? <ArrowDownLeft className="size-4 text-emerald-500" /> : <ArrowUpRight className="size-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1">
                {KIND[h.kind] ?? h.kind}
                <span className="ml-1.5 text-xs text-muted-foreground">{h.account.endsWith(":pending") ? "· refund window" : h.account.endsWith(":available") ? "· available" : "· payout"}</span>
                {h.note && <span className="block truncate text-xs text-muted-foreground">“{h.note}”</span>}
              </span>
              <span className={cn("font-medium tabular-nums", h.amountMinor >= 0 ? "text-emerald-600" : "")}>{h.amountMinor >= 0 ? "+" : "−"}{formatMoney(Math.abs(h.amountMinor), h.currency)}</span>
              <span className="w-20 text-right text-xs text-muted-foreground"><TimeAgo date={h.createdAt} /></span>
            </li>
          ))}
        </ul>
      </Section>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add bank account</DialogTitle><DialogDescription>Payouts are sent in US dollars by bank transfer. Details are encrypted.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Input value={m.bankName} onChange={(e) => setM((x) => ({ ...x, bankName: e.target.value }))} placeholder="Bank name" />
            <Input value={m.accountName} onChange={(e) => setM((x) => ({ ...x, accountName: e.target.value }))} placeholder="Account holder name" />
            <Input value={m.accountNumber} onChange={(e) => setM((x) => ({ ...x, accountNumber: e.target.value }))} placeholder="Account number or IBAN" autoComplete="off" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={m.swift} onChange={(e) => setM((x) => ({ ...x, swift: e.target.value }))} placeholder="SWIFT / BIC (international)" autoComplete="off" />
              <Input value={m.routingNumber} onChange={(e) => setM((x) => ({ ...x, routingNumber: e.target.value }))} placeholder="Routing number (US)" inputMode="numeric" autoComplete="off" />
            </div>
            <Input value={m.country} onChange={(e) => setM((x) => ({ ...x, country: e.target.value }))} placeholder="Country" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMethodOpen(false)}>Cancel</Button>
            <Button onClick={() => addMethod.mutate()} disabled={addMethod.isPending || !m.accountNumber || m.accountName.trim().length < 2 || m.bankName.trim().length < 2}>{addMethod.isPending && <Spinner />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TopUpDialog business={topUp ? { id: topUp.businessId, name: topUp.name } : null} onClose={() => setTopUp(null)} />
    </div>
  );
}
