// Shared building blocks for the generated 1200×630 link-preview images (next/og / Satori).
export const OG_SIZE = { width: 1200, height: 630 };

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").origin;
const MEDIA_ORIGINS = [API_ORIGIN, process.env.NEXT_PUBLIC_MEDIA_URL, process.env.R2_PUBLIC_URL]
  .filter(Boolean)
  .map((u) => { try { return new URL(u!).origin; } catch { return null; } })
  .filter(Boolean) as string[];

/**
 * Load one of OUR uploaded images and inline it as a data URI (Satori won't fetch private/local
 * addresses itself). Only our API / media origins are allowed, with a size and time limit.
 */
export async function inlineImage(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const u = new URL(url, API_ORIGIN);
    if (!MEDIA_ORIGINS.includes(u.origin)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(4000), next: { revalidate: 300 } });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|gif)$/.test(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 6_000_000) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Vector icons (no font downloads needed). */
export const OgIcon = {
  check: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  heart: (s: number, c = "#a1a1c2") => (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.1 4.5 6.8 4.5c2.1 0 3.5 1.1 4.2 2.3h2c.7-1.2 2.1-2.3 4.2-2.3 3.7 0 5.9 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" fill={c} /></svg>
  ),
  comment: (s: number, c = "#a1a1c2") => (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M4 5.5h16v10H9l-5 4v-14z" stroke={c} strokeWidth={2.2} fill="none" strokeLinejoin="round" /></svg>
  ),
  images: (s: number, c = "#a1a1c2") => (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke={c} strokeWidth={2.2} fill="none" /><path d="M3 16l5-5 4 4 3-3 6 6" stroke={c} strokeWidth={2.2} fill="none" strokeLinejoin="round" /></svg>
  ),
  lock: (s: number, c = "#a1a1c2") => (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2" fill={c} /><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke={c} strokeWidth={2.4} fill="none" /></svg>
  ),
  mask: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M2.5 7.5c3-1.3 6.3-1.3 9.5.4 3.2-1.7 6.5-1.7 9.5-.4 0 5.6-2.4 9.3-6 9.3-1.6 0-2.7-1-3.5-2.4-.8 1.4-1.9 2.4-3.5 2.4-3.6 0-6-3.7-6-9.3z" fill="white" /><ellipse cx="8" cy="11.3" rx="2" ry="1.3" fill="#f97316" /><ellipse cx="16" cy="11.3" rx="2" ry="1.3" fill="#f97316" /></svg>
  ),
};

export function OgVerified({ size }: { size: number }) {
  return <div style={{ width: size, height: size, borderRadius: 999, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>{OgIcon.check(size * 0.7)}</div>;
}

/** Satori can only draw PNG/JPEG/GIF; anything else falls back to the text design. */
export const drawable = (url?: string | null, mime?: string) =>
  !!url && (mime ? /^image\/(png|jpe?g|gif)$/.test(mime) : /\.(png|jpe?g|gif)(\?|$)/i.test(url));

export function OgLogo({ name, dark = true }: { name: string; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 60, height: 46, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 60, height: 15, borderRadius: 999, border: "3.5px solid #f97316", transform: "rotate(-12deg)", boxShadow: "0 0 6px 1px rgba(253,186,116,0.7)" }} />
        <div style={{ position: "absolute", width: 26, height: 26, borderRadius: 999, background: "#000", border: "1.5px solid #fff3d6", boxShadow: "0 0 8px 2px rgba(253,186,116,0.85)" }} />
        <div style={{ position: "absolute", width: 60, height: 15, borderRadius: 999, border: "3.5px solid #fb923c", borderTopColor: "rgba(0,0,0,0)", transform: "rotate(-12deg)" }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: dark ? "white" : "#0a0a0f" }}>{name}</div>
    </div>
  );
}

/** Round avatar, or initials on a gradient when there's no drawable photo. */
export function OgAvatar({ src, name, size, ring = "#ffffff" }: { src?: string | null; name: string; size: number; ring?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src!} width={size} height={size} alt="" style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", border: `${Math.round(size / 22)}px solid ${ring}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#8b84ff,#22d3a0)", color: "white", fontSize: size * 0.38, fontWeight: 800, border: `${Math.round(size / 22)}px solid ${ring}` }}>
      {initials || "?"}
    </div>
  );
}

export const clip = (t: string, n: number) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};
