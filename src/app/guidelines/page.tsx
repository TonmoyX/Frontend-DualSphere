import type { Metadata } from "next";
import { DocPage } from "@/components/common/doc-page";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How to be part of DualSphere: be kind, no harassment, spam or illegal content — and how anonymous posting keeps you private.",
  alternates: { canonical: "/guidelines" },
};

export default function GuidelinesPage() {
  return (
    <DocPage
      title="Community Guidelines"
      updated="November 2026"
      intro="DualSphere lets you speak as yourself or as no one. These rules keep it a place worth talking in."
    >
      <section>
        <h2>The basics</h2>
        <ul>
          <li><b>Be kind.</b> Disagree with ideas, not people.</li>
          <li><b>No harassment.</b> No bullying, threats, hate or targeting anyone — including in comments and messages.</li>
          <li><b>No spam.</b> No ads, scams, repetitive posts or fake engagement.</li>
          <li><b>Nothing illegal.</b> No illegal content, and no sharing other people&apos;s private information.</li>
        </ul>
      </section>

      <section>
        <h2>Anonymity is a privilege</h2>
        <p>
          Posting anonymously is for speaking freely — not for hurting people. Anonymous posts follow exactly the same rules.
          Abuse is reported, reviewed by moderators and actioned: content can be removed and accounts banned.
        </p>
      </section>

      <section id="anonymity">
        <h2>How anonymity works</h2>
        <ol>
          <li>Anonymous posts are stored with <code>author: null</code> — no name is attached to the post.</li>
          <li>Your link to the post is AES-256 encrypted in a separate, restricted store.</li>
          <li>Other users and moderators can&apos;t unmask you. Administrators can during an investigation (written reason + two-factor authentication), and it&apos;s permanently audit-logged — see the <a href="/privacy#admin-access">Privacy Policy</a>.</li>
          <li>Photo metadata (GPS location, device) is stripped in your browser before upload.</li>
          <li>Only you can see your own anonymous posts on your profile, and notifications about them are visible only to you.</li>
        </ol>
      </section>

      <section>
        <h2>Reporting</h2>
        <p>
          Use <b>Report</b> on any post, comment, message or profile. Reports are confidential — the person you report is never told who reported them.
          Something not working? Use <b>Report a problem</b> in your account menu.
        </p>
      </section>
    </DocPage>
  );
}
