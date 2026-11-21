import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to DualSphere — post as yourself or anonymously, chat with friends, and share stories.",
  alternates: { canonical: "/login" },
  openGraph: { title: "Log in", description: "Log in to DualSphere — post as yourself or anonymously, chat with friends, and share stories.", url: "/login", images: ["/opengraph-image"] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
