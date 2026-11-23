import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reels",
  description: "Short videos from across DualSphere.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
