import type { Metadata } from "next";
import { DocPage } from "@/components/common/doc-page";

export const metadata: Metadata = {
  title: "Terms & Community Rules",
  description: "The rules for using DualSphere — as yourself or anonymously.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <DocPage title="Terms & Community Rules" updated="November 2026" intro="Anonymity is a privilege, not a shield. These rules apply to everything you share, with or without your name.">
      <section>
        <h2>Who can use DualSphere</h2>
        <ul>
          <li>You must be at least 13 years old.</li>
          <li>One person, one account. Keep your password safe and turn on two-factor authentication.</li>
        </ul>
      </section>
      <section>
        <h2>Community rules</h2>
        <ul>
          <li>No harassment, bullying, threats or hate speech.</li>
          <li>No spam, scams or misleading content.</li>
          <li>No illegal content, and nothing that exploits or endangers children.</li>
          <li>Don&apos;t share other people&apos;s private information.</li>
          <li>Don&apos;t impersonate others.</li>
        </ul>
      </section>
      <section>
        <h2>Enforcement</h2>
        <p>Moderators review reports and may remove content or suspend accounts. In serious cases — such as credible threats or illegal content — administrators can identify the author of an anonymous post through an audited process described in our Privacy Policy.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>You own what you post. By posting, you allow DualSphere to store and display it to the audience you chose. You can delete your content at any time.</p>
      </section>
    </DocPage>
  );
}
