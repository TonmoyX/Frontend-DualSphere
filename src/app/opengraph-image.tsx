import { ImageResponse } from "next/og";
import { OgLogo } from "@/lib/og";
import { getSiteSettings } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DualSphere — Be yourself. Or be no one.";

/** Default link-preview image (used wherever a page has no image of its own). */
export default async function OgImage() {
  const s = await getSiteSettings();
  const name = s?.site.name ?? "DualSphere";
  const tagline = s?.site.tagline ?? "Be yourself. Or be no one.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0a0a0f 0%,#1b1740 60%,#0f2a24 100%)", color: "white" }}>
        <div style={{ display: "flex", transform: "scale(1.5)", transformOrigin: "left center" }}><OgLogo name={name} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 950 }}>{tagline}</div>
          <div style={{ fontSize: 30, color: "#b5b5d0" }}>Post as yourself or anonymously · Chat · Calls · Stories</div>
        </div>
      </div>
    ),
    size,
  );
}
