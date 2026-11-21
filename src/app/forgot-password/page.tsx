"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/common/bits";
import { AuthCard, FieldError } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, post } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AuthCard
      title="Reset password"
      subtitle={sent ? undefined : "We'll email you a secure link to set a new password."}
      footer={<Link href="/login" className="text-primary hover:underline">Back to log in</Link>}
    >
      {sent ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto size-10 text-anon" />
          <p className="text-sm text-muted-foreground">If <b className="text-foreground">{email}</b> is registered, a reset link is on its way. It expires in 1 hour.</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await post("/auth/forgot-password", { email });
              setSent(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <FieldError msg={error} />
          <Button className="h-10 w-full" disabled={busy}>{busy && <Spinner />} Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
