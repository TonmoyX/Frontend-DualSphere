"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative grid overflow-hidden min-h-[calc(100dvh-3.5rem)] place-items-center bg-grid px-4 py-12">
      <div className="pointer-events-none absolute top-0 left-1/2 h-80 w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,var(--glow),transparent_65%)]" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-md rounded-2xl border bg-card/90 p-7 shadow-2xl backdrop-blur"
      >
        <h1 className="mb-1 text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>}
        {children}
        {footer && <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
