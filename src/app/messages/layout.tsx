import type { Metadata } from "next";
import { privatePage } from "@/lib/seo";
import { MessagesShell } from "./messages-shell";

export const metadata: Metadata = privatePage("Messages");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
