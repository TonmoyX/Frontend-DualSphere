import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/feed", "/post/", "/profile/", "/login", "/signup", "/help", "/privacy", "/terms", "/cookies"],
        // Private, per-user areas
        disallow: ["/messages", "/notifications", "/saved", "/settings", "/friends", "/search", "/reset-password", "/verify-email", "/forgot-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
