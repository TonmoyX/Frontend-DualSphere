"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { v: Theme; label: string; Icon: typeof Sun; preview: string; bar: string; card: string }[] = [
  { v: "light", label: "Light", Icon: Sun, preview: "bg-[#f0f2f5]", bar: "bg-white", card: "bg-white border-black/10" },
  { v: "dark", label: "Dark", Icon: Moon, preview: "bg-[#0a0a0f]", bar: "bg-[#111118]", card: "bg-[#16161f] border-white/10" },
];

/** Light / dark picker with mini previews. */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          onClick={() => setTheme(o.v)}
          className={cn(
            "group rounded-xl border-2 p-2 text-left transition-colors",
            theme === o.v ? "border-primary" : "border-transparent bg-muted/40 hover:border-border",
          )}
        >
          <div className={cn("relative h-24 overflow-hidden rounded-lg border", o.preview)}>
            <div className={cn("h-4 w-full", o.bar)} />
            <div className={cn("mx-2 mt-2 h-6 rounded-md border", o.card)} />
            <div className={cn("mx-2 mt-1.5 h-6 rounded-md border", o.card)} />
            <span className="absolute right-2 bottom-2 size-3 rounded-full bg-[#6c63ff]" />
          </div>
          <div className="mt-2 flex items-center gap-2 px-1 text-sm font-medium">
            <o.Icon className="size-4" /> {o.label}
            {theme === o.v && <Check className="ml-auto size-4 text-primary" />}
          </div>
        </button>
      ))}
    </div>
  );
}
