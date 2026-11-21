import type { Metadata } from "next";
import { DocPage } from "@/components/common/doc-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DualSphere protects your identity, what we store, and the controls you have — including how anonymous posting works.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy Policy" updated="November 2026" intro="DualSphere is built so you can speak as yourself — or as no one. This page explains exactly what that means.">
      <section id="anonymity">
        <h2>How anonymous posting works</h2>
        <ul>
          <li>Anonymous posts are stored with <b>no author</b>. A database rule makes it impossible to attach an author to them.</li>
          <li>The only link between you and an anonymous post is encrypted (AES-256-GCM) and kept in a separate, restricted store.</li>
          <li>Anonymous posts never appear on your profile, in your photos, in notifications, or in any public API response.</li>
          <li>Photo location and device data (EXIF) is removed in your browser before upload.</li>
          <li>Revealing who wrote an anonymous post requires an administrator, a written reason and two-factor authentication. Every such lookup is permanently recorded in a tamper-evident audit log.</li>
        </ul>
      </section>
      <section>
        <h2>What we store</h2>
        <ul>
          <li><b>Account:</b> name, username, email, password (hashed with bcrypt), date of birth and gender (both private).</li>
          <li><b>Content you create:</b> posts, comments, messages, stories, photos, videos and voice messages.</li>
          <li><b>Security:</b> active sessions and a hashed fingerprint of devices you sign in from, used to alert you about new sign-ins. IP addresses are stored only as one-way hashes.</li>
        </ul>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Lock your profile so only friends can see your posts, photos and friends list.</li>
          <li>Choose who can see your friends list, and turn off your activity status.</li>
          <li>Block people, and review or sign out of active sessions.</li>
          <li>Deleting a post, comment or message removes it permanently from our database.</li>
          <li>Stories disappear automatically after 24 hours.</li>
        </ul>
      </section>
      <section>
        <h2>Calls</h2>
        <p>Voice and video calls connect your browser directly to the other person (peer-to-peer). Our servers only help the two devices find each other; call audio and video are not recorded or stored.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions or requests about your data? Use “Report a problem” from your account menu (⌘B) and choose “Account or login”.</p>
      </section>
    </DocPage>
  );
}
