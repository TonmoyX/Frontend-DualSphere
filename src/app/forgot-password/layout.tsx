import type { Metadata } from "next";
import { privatePage } from "@/lib/seo";

export const metadata: Metadata = privatePage("Forgotten password");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
