export { cn } from "cn"

/** "30 November" or "30 November 2002" — built in UTC so the day never shifts with the timezone. */
export function formatBirthday(b: { day: number; month: number; year?: number }) {
  return new Date(Date.UTC(b.year ?? 2000, b.month - 1, b.day)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    ...(b.year ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });
}

/** $1,250.00 from integer cents. The whole platform runs in US dollars. */
export function formatMoney(minor: number, _currency?: string | null) {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "250" / "250.50" typed by a person → minor units (or NaN). */
export function toMinor(input: string) {
  const n = Number(input.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : Number.NaN;
}
