"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/common/bits";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { errorMessage, post } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function Verify() {
  const token = useSearchParams().get("token");
  const { refetch } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [msg, setMsg] = useState(token ? "" : "Missing verification token.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    post("/auth/verify-email", { token })
      .then(() => {
        setState("ok");
        refetch();
      })
      .catch((e) => {
        setState("error");
        setMsg(errorMessage(e));
      });
  }, [token, refetch]);

  return (
    <AuthCard title="Email verification">
      <div className="space-y-4 text-center">
        {state === "loading" && <Spinner className="mx-auto size-8" />}
        {state === "ok" && <><CheckCircle2 className="mx-auto size-10 text-anon" /><p>Your email is verified. Welcome aboard!</p></>}
        {state === "error" && <><XCircle className="mx-auto size-10 text-destructive" /><p className="text-sm text-muted-foreground">{msg}</p></>}
        <Button asChild className="w-full"><Link href="/feed">Go to feed</Link></Button>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
