"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Construction, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { ElasticPull } from "./elastic-pull";
import { Navbar } from "./navbar";
import { SuspendedScreen } from "./suspended-screen";

const variantStyle = {
  info: "bg-identity/15 text-identity border-identity/25",
  success: "bg-anon/15 text-anon border-anon/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-destructive/15 text-destructive border-destructive/25",
};

/** Admin-controlled announcement banner (updates live). */
function Announcement() {
  const { site } = useSettings();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const a = site.announcement;
  const show = a.enabled && a.text && dismissed !== a.text;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn("overflow-hidden border-b text-sm", variantStyle[a.variant])}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
            <Megaphone className="size-4 shrink-0" />
            <p className="flex-1">
              {a.text}{" "}
              {a.link && (
                <a href={a.link} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-2">
                  Learn more
                </a>
              )}
            </p>
            <button onClick={() => setDismissed(a.text)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Maintenance({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-grid px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-warning/10 text-warning">
          <Construction className="size-8" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Under maintenance</h1>
        <p className="mb-6 text-muted-foreground">{message || "We'll be back shortly."}</p>
        <Button asChild variant="outline">
          <Link href="/login">Staff login</Link>
        </Button>
      </motion.div>
    </div>
  );
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const { user, suspended } = useAuth();
  const pathname = usePathname();
  const isStaff = user && user.role !== "user";
  const isAuthPage = ["/login", "/reset-password", "/forgot-password"].some((p) => pathname.startsWith(p));

  // Suspended account: one dedicated screen, whatever the URL (the rules pages stay readable)
  if (suspended && !["/terms", "/guidelines", "/privacy", "/help"].some((p) => pathname.startsWith(p))) {
    return <SuspendedScreen />;
  }

  if (settings.features.maintenanceMode && !isStaff && !isAuthPage) {
    return <Maintenance message={settings.features.maintenanceMessage} />;
  }

  // Auth screens (logged-out home, /login, /signup) get a clean, navbar-free layout
  const bare = (pathname === "/" && !user) || pathname === "/login" || pathname === "/signup";
  if (bare) {
    return (
      <div className="flex min-h-dvh flex-col bg-card">
        <Announcement />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Announcement />
      <Navbar />
      {/* The navbar stays put; pulling down at the top makes only the page sink a little */}
      <main className="flex-1">
        <ElasticPull disabled={pathname.startsWith("/messages")}>{children}</ElasticPull>
      </main>
    </div>
  );
}
