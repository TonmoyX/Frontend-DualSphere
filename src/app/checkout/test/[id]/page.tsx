"use client";

import { FlaskConical } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

/** Local test checkout (development only — the API refuses it in production). */
export default function TestCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<{ amountMinor: number; currency: string; purpose: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<{ amountMinor: number; currency: string; purpose: string; status: string }>(`/payments/${id}`).then(setP).catch((e) => toast.error(errorMessage(e))); }, [id]);
  const finish = async (outcome: "succeeded" | "failed") => {
    setBusy(true);
    try {
      await post(`/payments/test/${id}/complete`, { outcome });
      router.replace(`/checkout/result?payment=${id}&outcome=${outcome === "succeeded" ? "processing" : "failed"}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12">
      <div className="w-full rounded-2xl border-2 border-dashed border-amber-500/50 bg-card p-8 text-center">
        <FlaskConical className="mx-auto mb-3 size-10 text-amber-500" />
        <h1 className="text-xl font-bold">Test checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">Development only. No real money moves.</p>
        {p ? <p className="my-6 text-3xl font-bold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</p> : <Spinner className="mx-auto my-6 size-6" />}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!p || busy || p.status !== "created"} onClick={() => finish("succeeded")}>{busy && <Spinner />} Pay</Button>
          <Button className="flex-1" variant="secondary" disabled={!p || busy || p.status !== "created"} onClick={() => finish("failed")}>Decline</Button>
        </div>
      </div>
    </div>
  );
}
