"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/common/bits";
import { ConversationList } from "@/components/messages/conversation-list";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

/** Instagram-style two-pane inbox. On mobile, the list and the thread are separate screens. */
export function MessagesShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { features } = useSettings();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const inThread = !!params?.id;

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/messages");
  }, [loading, user, router]);

  if (!user) return <div className="grid h-[calc(100dvh-3.5rem)] place-items-center"><Spinner className="size-6 text-muted-foreground" /></div>;
  if (!features.messagingEnabled) {
    return (
      <div className="grid h-[calc(100dvh-3.5rem)] place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Messaging is turned off</p>
          <p className="mt-1 text-sm text-muted-foreground">The admins have temporarily disabled direct messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-6xl overflow-hidden bg-card md:border-x">
      <aside className={cn("w-full shrink-0 border-r md:w-[380px]", inThread && "hidden md:block")}>
        <ConversationList />
      </aside>
      <section className={cn("min-w-0 flex-1", !inThread && "hidden md:block")}>{children}</section>
    </div>
  );
}
