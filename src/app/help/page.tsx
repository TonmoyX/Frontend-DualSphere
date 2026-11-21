import type { Metadata } from "next";
import { DocPage } from "@/components/common/doc-page";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Answers to common questions about DualSphere: anonymous posts, friends, messages, calls, stories and privacy.",
  alternates: { canonical: "/help" },
};

const FAQ: [string, string][] = [
  ["How do I post anonymously?", "Open the composer (“What's on your mind?”), tap the Identity ▾ selector under your name, and choose Anonymous. New accounts can post anonymously after a short waiting period."],
  ["Can anyone find out who wrote my anonymous post?", "Other users and moderators can't. Only an administrator can, with a written reason and two-factor authentication — and every lookup is permanently logged. See the Privacy Policy for details."],
  ["Why did a message go to Requests?", "Messages from people who aren't your friends land in Requests. Accept the request to move it to your inbox, or delete or block the sender."],
  ["How do I make a voice or video call?", "Open a one-to-one chat and tap the phone or camera icon at the top. Your browser will ask for microphone/camera permission the first time."],
  ["How long do stories last?", "24 hours. You can see who viewed your story and delete it any time."],
  ["How do I lock my profile?", "Go to your profile, tap ⋯ → Lock profile (or Settings → Privacy). Only your friends will see your posts, photos and friends list."],
  ["What happens when I delete something?", "Deleting a post, comment or message removes it permanently. “Delete for me” on a message only hides it for you."],
  ["How do I report a problem?", "For posts, comments or messages, use their ⋯ menu → Report. For anything else, press ⌘B (Ctrl+B) or choose “Report a problem” in your account menu."],
];

export default function HelpPage() {
  return (
    <DocPage title="Help Center" intro="Quick answers to the most common questions.">
      <section className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border bg-card px-4 py-3 open:shadow-sm">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90">›</span>
              {q}
            </summary>
            <p className="mt-2 pl-5">{a}</p>
          </details>
        ))}
      </section>
    </DocPage>
  );
}
