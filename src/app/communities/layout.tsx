import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communities",
  description: "Find and join communities on DualSphere — post as yourself or anonymously, with each community's own rules.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
