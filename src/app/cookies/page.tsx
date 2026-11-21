import type { Metadata } from "next";
import { DocPage } from "@/components/common/doc-page";

export const metadata: Metadata = {
  title: "Cookies Policy",
  description: "DualSphere uses only essential cookies to keep you signed in securely. No advertising or tracking cookies.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <DocPage title="Cookies Policy" updated="November 2026" intro="We use the minimum needed to keep you signed in. No ads, no third-party trackers.">
      <section>
        <h2>Essential cookies</h2>
        <ul>
          <li><b>ds_access</b> — a short-lived (15 minute) sign-in token. HttpOnly, so scripts can&apos;t read it.</li>
          <li><b>ds_refresh</b> — keeps you signed in for up to 7 days, rotated on every use. HttpOnly.</li>
        </ul>
      </section>
      <section>
        <h2>Stored on your device</h2>
        <ul>
          <li><b>Theme</b> — your light/dark mode choice, kept in your browser&apos;s local storage.</li>
        </ul>
      </section>
      <section>
        <h2>Third parties</h2>
        <p>Animated emoji are loaded from Google&apos;s Noto Emoji service, and voice/video calls may use a public STUN server to connect. Neither sets cookies on our behalf.</p>
      </section>
    </DocPage>
  );
}
