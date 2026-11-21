"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, ChevronLeft, ChevronRight, CircleHelp, FileText, KeyRound, Laptop, LifeBuoy, Lock, LogOut, MessageSquareWarning, Moon, Settings,
  ScrollText, Shield, ShieldCheck, UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/common/bits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { ReportProblemDialog } from "./report-problem";

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
type Panel = "main" | "settings" | "help" | "display";

function Row({ icon, label, hint, href, onClick, chevron, danger }: {
  icon: ReactNode; label: string; hint?: string; href?: string; onClick?: () => void; chevron?: boolean; danger?: boolean;
}) {
  const inner = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] dark:bg-white/10 [&_svg]:size-5", danger && "text-destructive")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-medium", danger && "text-destructive")}>{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {chevron && <ChevronRight className="size-5 text-muted-foreground" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent";
  return href ? <Link href={href} onClick={onClick} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-1 flex items-center gap-2 px-1 pt-1">
      <button onClick={onBack} className="grid size-9 place-items-center rounded-full hover:bg-accent" aria-label="Back"><ChevronLeft className="size-6" /></button>
      <h3 className="font-sans text-xl font-bold tracking-normal">{title}</h3>
    </div>
  );
}

/** Facebook-style account menu: profile card, settings/help/display panels, report a problem, log out. */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const { site } = useSettings();
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("main");
  const [reporting, setReporting] = useState(false);

  // ⌘B / Ctrl+B → Report a problem (like Facebook)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        setOpen(false);
        setReporting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;
  const close = () => { setOpen(false); setTimeout(() => setPanel("main"), 200); };
  const year = new Date().getFullYear();

  const slide = {
    initial: (dir: number) => ({ x: dir * 40, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 40, opacity: 0 }),
  };
  const dir = panel === "main" ? -1 : 1;

  return (
    <>
      <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <PopoverTrigger className="relative ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-10" />
          <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full border-2 border-background bg-muted">
            <ChevronRight className="size-2.5 rotate-90" strokeWidth={3} />
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[min(360px,calc(100vw-1rem))] overflow-hidden p-2">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={panel} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.15 }}>
              {panel === "main" && (
                <>
                  {/* Profile card */}
                  <div className="mb-2 rounded-xl border bg-card p-1 shadow-sm">
                    <Link href={`/profile/${user.username}`} onClick={close} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
                      <UserAvatar src={user.avatarUrl} name={user.displayName} className="size-11" />
                      <span className="min-w-0">
                        <span className="block truncate text-[17px] font-semibold">{user.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
                      </span>
                    </Link>
                    {user.role !== "user" && (
                      <>
                        <div className="mx-2 my-1 border-t" />
                        <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
                          <span className="grid size-11 place-items-center rounded-full bg-warning/15 text-warning"><Shield className="size-5" /></span>
                          <span className="text-[15px] font-semibold">Admin panel</span>
                        </a>
                      </>
                    )}
                    <div className="mx-2 my-1 border-t" />
                    <Link href={`/profile/${user.username}`} onClick={close} className="m-1 flex items-center justify-center gap-2 rounded-lg bg-black/[0.06] py-2 dark:bg-white/10 text-[15px] font-semibold hover:bg-accent">
                      <UserRound className="size-5" /> See your profile
                    </Link>
                  </div>

                  <Row icon={<Bookmark />} label="Saved" hint="Posts you've saved" href="/saved" onClick={close} />
                  <Row icon={<Settings />} label="Settings & privacy" chevron onClick={() => setPanel("settings")} />
                  <Row icon={<CircleHelp />} label="Help & support" chevron onClick={() => setPanel("help")} />
                  <Row icon={<MessageSquareWarning />} label="Report a problem" hint="⌘ B" onClick={() => { close(); setReporting(true); }} />
                  <Row icon={<Moon />} label="Display & accessibility" chevron onClick={() => setPanel("display")} />
                  <Row icon={<LogOut />} label="Log out" onClick={async () => { close(); await logout(); router.push("/"); }} />

                  <p className="mt-2 px-2 text-xs leading-relaxed text-muted-foreground">
                    <Link href="/privacy" onClick={close} className="hover:underline">Privacy</Link> ·{" "}
                    <Link href="/terms" onClick={close} className="hover:underline">Terms</Link> ·{" "}
                    <Link href="/cookies" onClick={close} className="hover:underline">Cookies</Link> ·{" "}
                    <Link href="/guidelines" onClick={close} className="hover:underline">Guidelines</Link> ·{" "}
                    <Link href="/help" onClick={close} className="hover:underline">Help</Link> · {site.name} © {year}
                  </p>
                </>
              )}

              {panel === "settings" && (
                <>
                  <SubHeader title="Settings & privacy" onBack={() => setPanel("main")} />
                  <Row icon={<Settings />} label="Settings" hint="Profile, photos and account" href="/settings" onClick={close} />
                  <Row icon={<Lock />} label="Privacy" hint="Profile lock, friends list, activity status, blocking" href="/settings?tab=privacy" onClick={close} />
                  <Row icon={<KeyRound />} label="Password & security" hint="Password and two-factor authentication" href="/settings?tab=security" onClick={close} />
                  <Row icon={<Laptop />} label="Where you're logged in" hint="Active sessions" href="/settings?tab=sessions" onClick={close} />
                </>
              )}

              {panel === "help" && (
                <>
                  <SubHeader title="Help & support" onBack={() => setPanel("main")} />
                  <Row icon={<LifeBuoy />} label="Help Center" href="/help" onClick={close} />
                  <Row icon={<ScrollText />} label="Community guidelines" hint="Rules and how anonymity works" href="/guidelines" onClick={close} />
                  <Row icon={<ShieldCheck />} label="How anonymity works" href="/guidelines#anonymity" onClick={close} />
                  <Row icon={<FileText />} label="Terms & community rules" href="/terms" onClick={close} />
                  <Row icon={<MessageSquareWarning />} label="Report a problem" onClick={() => { close(); setReporting(true); }} />
                </>
              )}

              {panel === "display" && (
                <>
                  <SubHeader title="Display & accessibility" onBack={() => setPanel("main")} />
                  <div className="flex gap-3 px-2 py-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] dark:bg-white/10"><Moon className="size-5" /></span>
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold">Dark mode</p>
                      <p className="mb-2 text-xs text-muted-foreground">Adjust the appearance to reduce glare and give your eyes a break.</p>
                      {(["light", "dark"] as const).map((t) => (
                        <label key={t} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2.5 hover:bg-accent">
                          <span className="text-[15px] font-medium">{t === "dark" ? "On" : "Off"}</span>
                          <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} className="size-5 accent-[var(--primary)]" />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </PopoverContent>
      </Popover>
      <ReportProblemDialog open={reporting} onOpenChange={setReporting} />
    </>
  );
}
