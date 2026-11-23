"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CreditCard, FlaskConical, Heart, Landmark, Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage, get, post } from "@/lib/api";
import type { CreatorPublic } from "@/lib/types";
import { cn, formatMoney, toMinor } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

export type Provider = "stripe" | "sslcommerz" | "test";
const PROVIDER_LABEL: Record<Provider, { label: string; hint: string; Icon: typeof CreditCard }> = {
  stripe: { label: "Card (Stripe)", hint: "Visa, Mastercard, Amex — charged in US dollars", Icon: CreditCard },
  sslcommerz: { label: "SSLCommerz", hint: "Cards, mobile banking, net banking", Icon: Landmark },
  test: { label: "Test payment", hint: "Local development only — no real money", Icon: FlaskConical },
};
const PHONE = /^\+?[0-9]{8,15}$/;

export interface PayRequest {
  purpose: "tip" | "unlock" | "membership" | "ad_topup";
  creatorId?: string;
  postId?: string;
  tierId?: string;
  businessId?: string;
  amountMinor?: number;
  note?: string;
}

/** Starts a checkout and sends the browser to the provider. The server sets the price; we never trust the client. */
export function usePay() {
  return useMutation({
    mutationFn: (r: PayRequest & { provider: Provider; phone?: string }) => post<{ paymentId: string; redirectUrl: string }>("/payments", r),
    onSuccess: ({ redirectUrl }) => {
      // Only ever follow redirects to Stripe / SSLCommerz or our own site
      const u = new URL(redirectUrl, window.location.origin);
      const ok = u.origin === window.location.origin || /(^|\.)stripe\.com$/.test(u.hostname) || /(^|\.)sslcommerz\.com$/.test(u.hostname);
      if (!ok) { toast.error("Unexpected payment page — payment cancelled"); return; }
      window.location.assign(u.toString());
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Payment method + (for SSLCommerz) the buyer's phone. One hook used by every pay dialog. */
export function useCheckout() {
  const { data, isLoading } = useQuery({ queryKey: ["payment-providers"], queryFn: () => get<{ providers: Provider[] }>("/payments/providers") });
  const providers = data?.providers ?? [];
  const [picked, setPicked] = useState<Provider | null>(null);
  const [phone, setPhone] = useState("");
  const provider = picked && providers.includes(picked) ? picked : (providers[0] ?? null);
  const phoneOk = provider !== "sslcommerz" || PHONE.test(phone.replace(/[\s-]/g, ""));
  const pay = usePay();
  return {
    providers, isLoading, provider, setProvider: setPicked, phone, setPhone, pay,
    ready: !!provider && phoneOk && !pay.isPending,
    start: (r: PayRequest) => provider && pay.mutate({ ...r, provider, ...(provider === "sslcommerz" ? { phone: phone.replace(/[\s-]/g, "") } : {}) }),
  };
}

export function CheckoutChoice({ c }: { c: ReturnType<typeof useCheckout> }) {
  if (c.isLoading) return <Spinner className="size-4" />;
  if (!c.providers.length) return <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Payments aren&apos;t available right now.</p>;
  return (
    <div className="space-y-2">
      <div className="space-y-1.5" role="radiogroup" aria-label="Payment method">
        {c.providers.map((p) => {
          const meta = PROVIDER_LABEL[p];
          const active = c.provider === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => c.setProvider(p)}
              className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors", active ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border")}
            >
              <meta.Icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.hint}</span>
              </span>
              {active && <Check className="size-4 text-primary" />}
            </button>
          );
        })}
      </div>
      {c.provider === "sslcommerz" && (
        <div className="space-y-1">
          <Input value={c.phone} onChange={(e) => c.setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="Phone number (required by SSLCommerz)" aria-label="Phone number" />
          <p className="text-xs text-muted-foreground">Sent to SSLCommerz for this payment only. DualSphere doesn&apos;t store it.</p>
        </div>
      )}
    </div>
  );
}

/** Tip a creator (optionally for a specific post). */
export function TipDialog({ open, onOpenChange, creatorId, creatorName, postId }: {
  open: boolean; onOpenChange: (o: boolean) => void; creatorId: string; creatorName: string; postId?: string; currency?: string;
}) {
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState("");
  const c = useCheckout();
  const minor = toMinor(amount);
  const valid = Number.isFinite(minor) && minor >= 100 && minor <= 1_000_000;
  return (
    <Dialog open={open} onOpenChange={(o) => !c.pay.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Heart className="size-5 text-pink-500" /> Tip {creatorName}</DialogTitle>
          <DialogDescription>Tips go to the creator after a short refund window. DualSphere keeps a small fee.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {["1", "3", "5", "10", "25"].map((v) => (
            <button key={v} type="button" onClick={() => setAmount(v)} className={cn("rounded-full border px-3 py-1 text-sm font-medium", amount === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>
              ${v}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Tip amount in dollars" className="pl-6" />
        </div>
        {!valid && amount && <p className="text-xs text-destructive">Tips are between $1 and $10,000.</p>}
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a message (optional)" />
        <CheckoutChoice c={c} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={c.pay.isPending}>Cancel</Button>
          <Button disabled={!valid || !c.ready} onClick={() => c.start({ purpose: "tip", creatorId, postId, amountMinor: minor, note: note.trim() || undefined })}>
            {c.pay.isPending && <Spinner />} Send {valid ? formatMoney(minor, "USD") : "tip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pick a membership tier and pay for a month. */
export function SubscribeDialog({ open, onOpenChange, creatorName, info }: { open: boolean; onOpenChange: (o: boolean) => void; creatorName: string; info: CreatorPublic }) {
  const [tierId, setTierId] = useState<string | null>(info.membership?.tierId ?? info.tiers[0]?.id ?? null);
  const c = useCheckout();
  const tier = info.tiers.find((t) => t.id === tierId);
  return (
    <Dialog open={open} onOpenChange={(o) => !c.pay.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Become a member of {creatorName}</DialogTitle>
          <DialogDescription>
            {info.membership ? `You're a member until ${new Date(info.membership.currentPeriodEnd).toLocaleDateString()}. Paying again adds another month.` : "One month of access. Renew whenever you like — nothing is charged automatically."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {info.tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={cn("w-full rounded-xl border-2 p-3 text-left transition-colors", tierId === t.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border")}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{t.name}</span>
                <span className="font-semibold tabular-nums">{formatMoney(t.priceMinor, "USD")}<span className="text-xs font-normal text-muted-foreground">/month</span></span>
              </span>
              {t.description && <span className="mt-0.5 block text-sm text-muted-foreground">{t.description}</span>}
              {t.benefits.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-sm">{t.benefits.map((b) => <li key={b} className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" /> {b}</li>)}</ul>
              )}
            </button>
          ))}
        </div>
        <CheckoutChoice c={c} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={c.pay.isPending}>Cancel</Button>
          <Button disabled={!tier || !c.ready} onClick={() => tier && c.start({ purpose: "membership", tierId: tier.id })}>
            {c.pay.isPending && <Spinner />} Pay {tier ? formatMoney(tier.priceMinor, "USD") : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Locked paid / subscriber-only post: unlock or subscribe. */
export function LockedPostPanel({ postId, access, priceMinor, mediaCount, authorUsername, authorName }: {
  postId: string; access: "subscribers" | "paid"; priceMinor: number | null; currency?: string | null; mediaCount: number; authorUsername: string; authorName: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const c = useCheckout();
  return (
    <div className="mt-3 rounded-xl border border-dashed bg-muted/40 p-4 text-center">
      <Lock className="mx-auto mb-1.5 size-6 text-muted-foreground" />
      <p className="text-sm font-semibold">{access === "paid" ? "Paid post" : "Members only"}</p>
      <p className="mb-3 text-xs text-muted-foreground">
        {mediaCount > 0 ? `${mediaCount} photo${mediaCount > 1 ? "s/videos" : "/video"} and the full text ` : "The full post "}
        {access === "paid" ? "unlock after a one-time payment, or with a membership." : `are for ${authorName}'s members.`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {access === "paid" && priceMinor != null && (
          <Button size="sm" onClick={() => (user ? setOpen(true) : router.push("/login"))}><Lock /> Unlock for {formatMoney(priceMinor, "USD")}</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => router.push(`/profile/${authorUsername}?join=1`)}><Sparkles /> See memberships</Button>
      </div>
      <Dialog open={open} onOpenChange={(o) => !c.pay.isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock this post</DialogTitle>
            <DialogDescription>One-time payment of {priceMinor != null ? formatMoney(priceMinor, "USD") : ""}. You keep access to this post.</DialogDescription>
          </DialogHeader>
          <CheckoutChoice c={c} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={c.pay.isPending}>Cancel</Button>
            <Button disabled={!c.ready} onClick={() => c.start({ purpose: "unlock", postId })}>
              {c.pay.isPending && <Spinner />} Pay {priceMinor != null ? formatMoney(priceMinor, "USD") : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Advertiser top-up (Ads Manager + Wallet). */
export function TopUpDialog({ business, onClose }: { business: { id: string; name: string } | null; onClose: () => void }) {
  const [amount, setAmount] = useState("50");
  const c = useCheckout();
  const minor = toMinor(amount);
  const valid = Number.isFinite(minor) && minor >= 500;
  return (
    <Dialog open={!!business} onOpenChange={(o) => !o && !c.pay.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ad funds{business ? ` · ${business.name}` : ""}</DialogTitle>
          <DialogDescription>Prepaid balance in US dollars. Ads stop when it runs out — you&apos;re never charged more than you add.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in dollars" className="pl-6" />
        </div>
        {!valid && amount && <p className="text-xs text-destructive">Add at least $5.</p>}
        <CheckoutChoice c={c} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={c.pay.isPending}>Cancel</Button>
          <Button disabled={!business || !valid || !c.ready} onClick={() => business && c.start({ purpose: "ad_topup", businessId: business.id, amountMinor: minor })}>
            {c.pay.isPending && <Spinner />} Add {valid ? formatMoney(minor, "USD") : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
