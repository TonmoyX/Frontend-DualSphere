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
          <li>Anonymous means <b>other users and moderators</b> can&apos;t see it&apos;s you. Administrators can: see <a href="#admin-access">Administrator access</a> below.</li>
        </ul>
      </section>
      <section id="admin-access">
        <h2>Administrator access</h2>
        <p>To keep people safe and meet legal obligations, DualSphere administrators can investigate an account. During an investigation an administrator can:</p>
        <ul>
          <li>See who wrote any anonymous post, including <b>every anonymous post written by the account under investigation</b>.</li>
          <li>Read that account&apos;s <b>direct messages and group chats</b>, including messages deleted or edited in the last 90 days.</li>
        </ul>
        <p>Safeguards:</p>
        <ul>
          <li>Only administrators (not moderators) can do this, and only after two-factor authentication and a written reason.</li>
          <li>Each investigation covers <b>one account</b> and ends automatically after 30 minutes.</li>
          <li>Every investigation and every conversation or post viewed in it is permanently recorded in a tamper-evident audit log that other administrators can review.</li>
          <li>Moderators handling a report only see the reported item itself.</li>
        </ul>
      </section>
      <section>
        <h2>What we store</h2>
        <ul>
          <li><b>Account:</b> name, username, email, password (hashed with bcrypt), date of birth and gender (both private).</li>
          <li><b>Content you create:</b> posts, comments, messages, stories, photos, videos and voice messages. Messages are stored on our servers (they are not end-to-end encrypted).</li>
          <li><b>Security:</b> active sessions and a hashed fingerprint of devices you sign in from, used to alert you about new sign-ins. IP addresses are stored only as one-way hashes.</li>
        </ul>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Lock your profile so only friends can see your posts, photos and friends list.</li>
          <li>Choose who can see your friends list, and turn off your activity status.</li>
          <li>Block people, and review or sign out of active sessions.</li>
          <li>Deleting a post or comment removes it permanently from our database.</li>
          <li>Unsending or deleting a message removes it for everyone straight away. A copy (and earlier versions of edited messages) is kept for <b>90 days</b> for safety investigations only, then permanently deleted.</li>
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
