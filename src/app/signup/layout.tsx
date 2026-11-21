import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a new account",
  description: "Join DualSphere: one account, two voices. Share as yourself or speak freely and anonymously, with privacy by design.",
  alternates: { canonical: "/signup" },
  openGraph: { title: "Create a new account", description: "Join DualSphere: one account, two voices. Share as yourself or speak freely and anonymously, with privacy by design.", url: "/signup", images: ["/opengraph-image"] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
