"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const box =
  "peer block h-14 w-full rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-[15px] text-foreground outline-none transition-[border-color,box-shadow] " +
  "focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20";
const label =
  "pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-foreground transition-all duration-150 " +
  "peer-focus:top-4 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-xs";

type InputProps = Omit<ComponentProps<"input">, "placeholder"> & { label: string; error?: string | null };

/** Input whose label sits inside the box and floats up on focus / when filled. */
export function FloatingInput({ label: text, error, className, type = "text", ...props }: InputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={isPassword && visible ? "text" : type}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          className={cn(box, isPassword && "pr-12")}
        />
        <label htmlFor={id} className={label}>{text}</label>
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            title={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 px-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

type SelectProps = Omit<ComponentProps<"select">, "children"> & {
  placeholder: string;
  options: { value: string; label: string }[];
  error?: string | null;
};

/** Native select (accessible, mobile-friendly) styled to match FloatingInput. */
export function FloatingSelect({ placeholder, options, error, className, value, ...props }: SelectProps) {
  return (
    <div className={className}>
      <div className="relative">
        <select
          {...props}
          value={value}
          aria-invalid={error ? true : undefined}
          className={cn(
            "block h-14 w-full appearance-none rounded-xl border border-input bg-card pr-10 pl-4 text-[15px] outline-none transition-[border-color,box-shadow]",
            "focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-destructive",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-foreground">{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
      </div>
      {error && <p className="mt-1 px-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
