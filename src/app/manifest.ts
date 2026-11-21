import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/seo";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSiteSettings();
  const name = s?.site.name ?? "DualSphere";
  return {
    name: `${name} — ${s?.site.tagline ?? "Be yourself. Or be no one."}`,
    short_name: name,
    description: s?.site.description ?? "A dual-mode social platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f2f5",
    theme_color: "#6c63ff",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
    categories: ["social", "communication"],
  };
}
