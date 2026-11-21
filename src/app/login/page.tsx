"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AuthLanding } from "@/components/auth/auth-landing";
import { useAuth } from "@/providers/auth-provider";

function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function LoginInner() {
  const router = useRouter();
  const { user } = useAuth();
  const next = safeNext(useSearchParams().get("next"));
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);
  return <AuthLanding onSuccess={() => router.push(next)} />;
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
