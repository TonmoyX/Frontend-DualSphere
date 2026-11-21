import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SiteChrome } from "@/components/layout/site-chrome";
import { getSiteSettings, SITE_URL } from "@/lib/seo";
import { Providers } from "@/providers/providers";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// Landing headline: a clean geometric sans paired with an elegant italic serif accent
// Headings everywhere: a clean, normal-width professional sans
const display = Plus_Jakarta_Sans({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const serif = Instrument_Serif({ variable: "--font-serif-accent", subsets: ["latin"], weight: "400", style: ["italic"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const name = s?.site.name ?? "DualSphere";
  const tagline = s?.site.tagline ?? "Be yourself. Or be no one.";
  const description = s?.site.description ?? "A dual-mode social platform: post with your identity, or speak freely and anonymously — with zero-leakage privacy.";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${name} — ${tagline}`, template: `%s · ${name}` },
    description,
    applicationName: name,
    keywords: ["social network", "anonymous posting", "privacy", "messaging", "stories", "friends", name],
    openGraph: { type: "website", siteName: name, title: `${name} — ${tagline}`, description, url: "/", locale: "en_US" },
    twitter: { card: "summary_large_image", title: `${name} — ${tagline}`, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  return (
    <html lang="en" className={`${dmSans.variable} ${mono.variable} ${display.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark theme before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <Providers initialSettings={settings}>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
