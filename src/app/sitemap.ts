import type { MetadataRoute } from "next";
import { apiGet, SITE_URL } from "@/lib/seo";
import type { FeedPage } from "@/lib/types";

export const revalidate = 3600;

/** Public pages + recent public posts and the identity profiles behind them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/guidelines`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const feed = await apiGet<FeedPage>("/feed?mode=all&limit=50", 3600);
  const posts = feed?.posts ?? [];
  const profiles = new Map<string, string>();
  for (const p of posts) {
    pages.push({ url: `${SITE_URL}/post/${p.id}`, lastModified: new Date(p.createdAt), changeFrequency: "weekly", priority: 0.7 });
    if (p.author && !profiles.has(p.author.username)) profiles.set(p.author.username, p.createdAt); // never for anonymous posts
  }
  for (const [username, last] of profiles) {
    pages.push({ url: `${SITE_URL}/profile/${username}`, lastModified: new Date(last), changeFrequency: "daily", priority: 0.6 });
  }
  return pages;
}
