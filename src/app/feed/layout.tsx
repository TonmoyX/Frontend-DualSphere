import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed",
  description: "The latest identity and anonymous posts on DualSphere.",
  alternates: { canonical: "/feed" },
  openGraph: { title: "Feed", description: "The latest identity and anonymous posts on DualSphere.", url: "/feed", images: ["/opengraph-image"] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
