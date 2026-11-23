"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { get, post } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

interface PaymentStatus { id: string; purpose: string; status: string; amountMinor: number; currency: string; postId: string | null; businessId: string | null }

export default function CheckoutResultPage() {
  return <Suspense><Result /></Suspense>;
}

function Result() {
  const params = useSearchParams();
  const paymentId = params.get("payment") ?? "";
  const outcome = params.get("outcome");
  const [p, setP] = useState<PaymentStatus | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  // Confirm with the server (which asks Stripe directly), polling briefly while the provider finishes
  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return;
    let stop = false;
    (async () => {
      for (let i = 0; i < 12 && !stop; i++) {
        try {
          if (outcome !== "canceled") await post(`/payments/${paymentId}/confirm`).catch(() => null);
          const s = await get<PaymentStatus>(`/payments/${paymentId}`);
          if (stop) return;
          setP(s);
          if (s.status !== "created") return;
          if (outcome === "canceled" || outcome === "failed") return;
        } catch { /* keep trying briefly */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) setGaveUp(true);
    })();
    return () => { stop = true; };
  }, [paymentId, outcome]);

  const next = p?.purpose === "ad_topup" ? { href: "/ads", label: "Back to Ads Manager" }
    : p?.purpose === "unlock" && p.postId ? { href: `/post/${p.postId}`, label: "Open the post" }
    : { href: "/wallet", label: "Go to wallet" };

  const ok = p?.status === "succeeded";
  const failed = p && ["failed", "expired"].includes(p.status) || (p?.status === "created" && (outcome === "canceled" || outcome === "failed"));
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12 text-center">
      <div className="w-full rounded-2xl border bg-card p-8">
        {!p && !gaveUp && <><Spinner className="mx-auto mb-3 size-7" /><p className="font-medium">Checking your payment…</p></>}
        {ok && <><CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" /><h1 className="text-xl font-bold">Payment complete</h1><p className="mt-1 text-sm text-muted-foreground">{formatMoney(p.amountMinor, p.currency)} · thank you!</p></>}
        {failed && <><XCircle className="mx-auto mb-3 size-12 text-destructive" /><h1 className="text-xl font-bold">{outcome === "canceled" ? "Payment cancelled" : "Payment didn't go through"}</h1><p className="mt-1 text-sm text-muted-foreground">You weren&apos;t charged.</p></>}
        {p?.status === "created" && !failed && (gaveUp ? (
          <><Clock className="mx-auto mb-3 size-12 text-amber-500" /><h1 className="text-xl font-bold">Still processing</h1><p className="mt-1 text-sm text-muted-foreground">We&apos;ll update your wallet as soon as the payment is confirmed.</p></>
        ) : <><Spinner className="mx-auto mb-3 size-7" /><p className="font-medium">Confirming with the payment provider…</p></>)}
        {p?.status === "refunded" && <h1 className="text-xl font-bold">This payment was refunded</h1>}
        <Button asChild className="mt-6 w-full"><Link href={next.href}>{next.label}</Link></Button>
      </div>
    </div>
  );
}
