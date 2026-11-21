"use client";

import { motion } from "framer-motion";
import { Heart, Lock, MessageCircle, Smile, UserRound, VenetianMask } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import type { SelfUser } from "@/lib/types";
import { useSettings } from "@/providers/settings-provider";
import { LoginForm } from "./login-form";

const float = (delay = 0, y = 8) => ({
  animate: { y: [0, -y, 0] },
  transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay },
});

/**
 * Original collage (identity post, anonymous post, reaction bubbles).
 * Every position/size is a percentage of a fixed-aspect box, so it scales
 * to any width and is never clipped.
 */
function Illustration() {
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[540px] select-none lg:w-[clamp(280px,calc((100dvh-30rem)*1.1),540px)]" aria-hidden>
      {/* Identity post (tall card, back) */}
      <motion.div {...float(0, 6)} className="absolute top-[2%] left-[38%] w-[52%] overflow-hidden rounded-[7%/5%] border bg-card shadow-2xl">
        <div className="h-1 bg-muted"><div className="h-full w-2/5 rounded-full bg-identity" /></div>
        <div className="flex items-center gap-[6%] p-[6%]">
          <div className="grid aspect-square w-[16%] place-items-center rounded-full bg-identity/15 text-identity"><UserRound className="size-1/2" /></div>
          <div className="flex-1 space-y-1.5">
            <div className="h-1.5 w-3/4 rounded-full bg-foreground/70 sm:h-2" />
            <div className="h-1 w-1/2 rounded-full bg-muted-foreground/40 sm:h-1.5" />
          </div>
        </div>
        <div className="mx-[6%] aspect-[4/5] rounded-[8%] bg-[linear-gradient(140deg,#8b84ff_0%,#a78bfa_35%,#f472b6_70%,#fbbf24_100%)]">
          <div className="flex h-full items-end p-[6%]">
            <div className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white backdrop-blur sm:text-[11px]">on profile</div>
          </div>
        </div>
        <div className="flex items-center gap-[8%] p-[6%] text-muted-foreground">
          <Heart className="size-[14%] fill-pink-500 text-pink-500" />
          <MessageCircle className="size-[14%]" />
        </div>
      </motion.div>

      {/* Anonymous post (front card) */}
      <motion.div {...float(1.2, 7)} className="absolute top-[38%] left-[4%] w-[46%] rounded-[9%/12%] border border-anon/30 bg-card p-[3.5%] shadow-2xl">
        <div className="mb-[6%] flex items-center gap-[5%]">
          <div className="grid aspect-square w-[18%] place-items-center rounded-full bg-anon/15 text-anon"><VenetianMask className="size-1/2" /></div>
          <div className="text-[11px] font-semibold text-anon sm:text-sm">Anonymous</div>
        </div>
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-foreground/60 sm:h-2" />
          <div className="h-1.5 w-11/12 rounded-full bg-foreground/60 sm:h-2" />
          <div className="h-1.5 w-2/3 rounded-full bg-foreground/60 sm:h-2" />
        </div>
        <div className="mt-[7%] flex items-center gap-1 rounded-lg bg-anon/10 px-2 py-1 text-[9px] font-medium whitespace-nowrap text-anon sm:text-[11px]">
          <Lock className="size-3 shrink-0" /> Identity encrypted
        </div>
      </motion.div>

      {/* Reaction bubbles */}
      <motion.div {...float(0.4, 10)} className="absolute top-[12%] left-[14%] grid aspect-square w-[14%] place-items-center rounded-full bg-amber-300 text-amber-900 shadow-xl">
        <Smile className="size-3/5" strokeWidth={2.2} />
      </motion.div>
      <motion.div {...float(0.8, 9)} className="absolute top-[58%] right-[2%] grid aspect-square w-[14%] place-items-center rounded-full bg-pink-500 text-white shadow-xl shadow-pink-500/30">
        <Heart className="size-1/2 fill-current" />
      </motion.div>
      <motion.div {...float(1.6, 8)} className="absolute bottom-[1%] left-[42%] grid aspect-square w-[20%] place-items-center rounded-full border-4 border-card bg-gradient-to-br from-anon to-cyan-500 text-white shadow-2xl">
        <VenetianMask className="size-1/2" />
      </motion.div>
      <motion.div {...float(2, 6)} className="absolute top-[6%] right-[0%] rounded-full bg-identity px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-white shadow-lg sm:text-xs">
        2 voices · 1 account
      </motion.div>
    </div>
  );
}

/**
 * Logged-out home + /login.
 * Mobile:  logo + headline → login → illustration
 * Desktop: [logo, headline, illustration] | [login]
 */
export function AuthLanding({ onSuccess }: { onSuccess?: (u: SelfUser) => void }) {
  const { site, features } = useSettings();
  const words = site.tagline.trim().split(/\s+/);
  const accent = words.length > 2 ? words.slice(-2).join(" ") : "";
  const lead = accent ? words.slice(0, -2).join(" ") : site.tagline;

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[1400px] lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[auto_1fr]">
      {/* Brand + headline */}
      <section className="px-5 pt-6 sm:px-10 sm:pt-8 lg:col-start-1 lg:row-start-1 lg:px-14 lg:pt-10">
        <Logo name={site.name} className="text-xl sm:text-2xl [&>span:first-child]:size-10 sm:[&>span:first-child]:size-12" />
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ fontFamily: "var(--font-display), var(--font-dm-sans), sans-serif" }}
          className="mt-6 max-w-2xl text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-foreground sm:mt-10 sm:text-[4rem] lg:mt-8 lg:text-[3.6rem] 2xl:text-[4.6rem]"
        >
          {lead}{" "}
          {accent && (
            <span
              style={{ fontFamily: "var(--font-serif-accent), Georgia, serif" }}
              className="inline-block bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text pr-[0.08em] text-[1.12em] leading-[0.9] font-normal tracking-[-0.01em] whitespace-nowrap text-transparent italic dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400"
            >
              {accent}
            </span>
          )}
        </motion.h1>
        <p className="mt-3 max-w-lg text-[15px] text-muted-foreground sm:mt-4 sm:text-base">{site.description}</p>
      </section>

      {/* Login */}
      <section className="flex justify-center px-5 py-8 sm:px-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:items-center lg:border-l lg:px-14 lg:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[460px]">
          <h2 className="mb-5 font-sans text-xl font-semibold tracking-normal">Log in to {site.name}</h2>
          <LoginForm onSuccess={onSuccess} />
          {features.registrationEnabled && (
            <Button asChild variant="outline" className="mt-8 h-12 w-full rounded-full border-primary/60 text-base font-semibold text-primary hover:bg-primary/5 hover:text-primary sm:mt-14 dark:border-primary/60">
              <Link href="/signup">Create new account</Link>
            </Button>
          )}
          <div className="mt-6 flex justify-center opacity-80">
            <Logo name={site.name} className="text-base [&>span:first-child]:size-6" />
          </div>
        </motion.div>
      </section>

      {/* Illustration (below the headline) */}
      <section className="px-6 pb-10 sm:px-12 lg:col-start-1 lg:row-start-2 lg:flex lg:items-start lg:justify-center lg:px-14 lg:pt-6 lg:pb-10">
        <Illustration />
      </section>
    </div>
  );
}
