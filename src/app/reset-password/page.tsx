"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Spinner } from "@/components/common/bits";
import { AuthCard, FieldError } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { errorMessage, post } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="All your other sessions were signed out for safety.">
        <Button asChild className="w-full"><Link href="/login">Log in</Link></Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirm) return setError("Passwords don't match");
          setBusy(true);
          setError(null);
          try {
            await post("/auth/reset-password", { token, password });
            setDone(true);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {!token && <FieldError msg="Missing reset token — open the link from your email." />}
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <PasswordInput id="pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">Confirm password</Label>
          <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <FieldError msg={error} />
        <Button className="h-10 w-full" disabled={busy || !token}>{busy && <Spinner />} Update password</Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
