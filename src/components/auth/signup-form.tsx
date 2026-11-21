"use client";

import { HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Spinner } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, errorMessage, post } from "@/lib/api";
import type { SelfUser } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { FloatingInput, FloatingSelect } from "./floating-field";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "custom", label: "Custom" },
  { value: "prefer_not_say", label: "Prefer not to say" },
];

function Heading({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[17px] font-semibold">
      {children}
      {help && (
        <Tooltip>
          <TooltipTrigger type="button" aria-label="More info" className="text-muted-foreground hover:text-foreground">
            <HelpCircle className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{help}</TooltipContent>
        </Tooltip>
      )}
    </h2>
  );
}

/** Full sign-up form: name, birthday, gender, email, username, password. */
export function SignupForm({ onSuccess }: { onSuccess?: (u: SelfUser) => void }) {
  const { setUser } = useAuth();
  const { limits } = useSettings();
  const [f, setF] = useState({ first: "", last: "", day: "", month: "", year: "", gender: "", email: "", username: "", password: "", website: "" });
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 108 }, (_, i) => String(now - 13 - i)).map((y) => ({ value: y, label: y }));
  }, []);
  const daysInMonth = f.month && f.year ? new Date(Number(f.year), Number(f.month), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  const suggestUsername = (first: string, last: string) =>
    `${first}${last}`.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setF((cur) => {
      const next = { ...cur, [k]: v };
      if ((k === "first" || k === "last") && !usernameTouched) next.username = suggestUsername(next.first, next.last);
      if ((k === "month" || k === "year") && next.day && next.month && next.year) {
        const max = new Date(Number(next.year), Number(next.month), 0).getDate();
        if (Number(next.day) > max) next.day = String(max);
      }
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const local: Record<string, string> = {};
    if (!f.day || !f.month || !f.year) local.birthDate = "Select your date of birth";
    if (!f.gender) local.gender = "Select your gender";
    if (Object.keys(local).length) return setErrors(local);
    setErrors({});
    setBusy(true);
    try {
      const birthDate = `${f.year}-${f.month.padStart(2, "0")}-${f.day.padStart(2, "0")}`;
      const r = await post<{ user: SelfUser }>("/auth/signup", {
        displayName: `${f.first.trim()} ${f.last.trim()}`.trim(),
        birthDate,
        gender: f.gender,
        email: f.email,
        username: f.username,
        password: f.password,
        website: f.website,
      });
      setUser(r.user);
      onSuccess?.(r.user);
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        setErrors(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      }
      if (err instanceof ApiError && err.code === "USERNAME_TAKEN") setErrors({ username: err.message });
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate={false}>
      <section>
        <Heading>Name</Heading>
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput label="First name" autoComplete="given-name" value={f.first} onChange={set("first")} required maxLength={32} error={errors.displayName} />
          <FloatingInput label="Surname" autoComplete="family-name" value={f.last} onChange={set("last")} maxLength={31} />
        </div>
      </section>

      <section>
        <Heading help="You must be at least 13 to sign up. Your birthday is private and never shown on your profile.">Date of birth</Heading>
        <div className="grid grid-cols-3 gap-3">
          <FloatingSelect aria-label="Day" placeholder="Day" options={days} value={f.day} onChange={set("day")} />
          <FloatingSelect aria-label="Month" placeholder="Month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} value={f.month} onChange={set("month")} />
          <FloatingSelect aria-label="Year" placeholder="Year" options={years} value={f.year} onChange={set("year")} />
        </div>
        {errors.birthDate && <p className="mt-1 px-1 text-xs text-destructive">{errors.birthDate}</p>}
      </section>

      <section>
        <Heading help="Kept private. It's never shown on your profile or to other people.">Gender</Heading>
        <FloatingSelect aria-label="Gender" placeholder="Select your gender" options={GENDERS} value={f.gender} onChange={set("gender")} error={errors.gender} />
      </section>

      <section>
        <Heading>Email address</Heading>
        <FloatingInput label="Email address" type="email" autoComplete="email" value={f.email} onChange={set("email")} required error={errors.email} />
        <p className="mt-2 text-sm text-muted-foreground">We&apos;ll send a link to verify it. Your email is never shown publicly.</p>
      </section>

      <section>
        <Heading help="Your public handle, used in your profile link. Letters, numbers and underscores.">Username</Heading>
        <FloatingInput
          label="Username"
          autoComplete="username"
          value={f.username}
          onChange={(e) => { setUsernameTouched(true); set("username")(e); }}
          required
          pattern="[a-zA-Z0-9_]{3,32}"
          title="3–32 letters, numbers or underscores"
          error={errors.username}
        />
        {f.username && <p className="mt-2 text-sm text-muted-foreground">Your profile: dualsphere/profile/<b className="text-foreground">{f.username}</b></p>}
      </section>

      <section>
        <Heading>Password</Heading>
        <FloatingInput label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={8} error={errors.password} />
        <p className="mt-2 text-sm text-muted-foreground">At least 8 characters, with a letter and a number.</p>
      </section>

      {/* Honeypot — hidden from humans, bots fill it in */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />

      <p className="text-sm leading-relaxed text-muted-foreground">
        On DualSphere you can post as yourself or anonymously. Anonymous posts are never linked to your profile.
        Anonymous posting unlocks {limits.anonAccountAgeHours} hours after you sign up.
      </p>

      {error && !Object.keys(errors).length && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button disabled={busy} className="h-12 w-full rounded-full text-base font-semibold">
        {busy && <Spinner />} Sign up
      </Button>
    </form>
  );
}
