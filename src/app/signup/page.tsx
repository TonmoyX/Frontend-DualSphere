"use client";

import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { Logo } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

export default function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { site, features } = useSettings();

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pt-4 pb-16">
      <Link href="/" aria-label="Back" className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
        <ChevronLeft className="size-6" />
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Logo name={site.name} className="mt-2 text-base [&>span:first-child]:size-6" />
        <h1 className="mt-3 font-sans text-[28px] leading-tight font-bold tracking-normal">Get started on {site.name}</h1>
        <p className="mt-1.5 mb-8 text-[15px] text-muted-foreground">
          Create your account to share as yourself, or speak freely and anonymously, easily and securely.
        </p>

        {features.registrationEnabled ? (
          <SignupForm onSuccess={() => router.push("/")} />
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="font-semibold">Registration is closed</p>
            <p className="mt-1 text-sm text-muted-foreground">New sign-ups are paused right now. Please check back later.</p>
          </div>
        )}

        <Button asChild variant="outline" className="mt-4 h-12 w-full rounded-full text-base font-semibold">
          <Link href="/login">I already have an account</Link>
        </Button>
      </motion.div>
    </div>
  );
}
