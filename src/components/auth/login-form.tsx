"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, post } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { FloatingInput } from "./floating-field";

type LoginRes = { mfaRequired: true; challenge: string } | { mfaRequired: false; user: SelfUser };

/** Email/username + password login with a TOTP step when 2FA is on. */
export function LoginForm({ onSuccess }: { onSuccess?: (u: SelfUser) => void }) {
  const { setUser } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (u: SelfUser) => {
    setUser(u);
    onSuccess?.(u);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (challenge) {
        const r = await post<{ user: SelfUser }>("/auth/login/mfa", { challenge, code });
        done(r.user);
      } else {
        const r = await post<LoginRes>("/auth/login", { identifier, password });
        if (r.mfaRequired) setChallenge(r.challenge);
        else done(r.user);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pill = "h-12 w-full rounded-full text-base font-semibold";

  if (challenge) {
    return (
      <form onSubmit={submit} className="space-y-4">
        <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck /></div>
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Authentication code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.5em]"
          placeholder="000000"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className={pill} disabled={busy || code.length !== 6}>{busy && <Spinner />} Verify</Button>
        <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); }} className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FloatingInput label="Email address or username" autoComplete="username" autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      <FloatingInput label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
      <div className="pt-2">
        <Button className={pill} disabled={busy}>{busy && <Spinner />} Log in</Button>
      </div>
      <div className="pt-3 text-center">
        <Link href="/forgot-password" className="text-[15px] font-medium hover:underline">Forgotten password?</Link>
      </div>
    </form>
  );
}
