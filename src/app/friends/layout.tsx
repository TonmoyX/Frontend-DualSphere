import type { Metadata } from "next";
import { privatePage } from "@/lib/seo";

export const metadata: Metadata = privatePage("Friends", "Friend requests, suggestions and people you may know.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
