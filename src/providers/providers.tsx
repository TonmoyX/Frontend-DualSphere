"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./auth-provider";
import { SettingsProvider } from "./settings-provider";
import { RealtimeBridge } from "./realtime-bridge";
import { CallProvider } from "@/components/calls/call-provider";
import { GroupCallProvider } from "@/components/calls/group-call";
import type { PublicSettings } from "@/lib/types";

export function Providers({ children, initialSettings }: { children: ReactNode; initialSettings: PublicSettings | null }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (n, err: unknown) => n < 2 && ![401, 403, 404].includes((err as { status?: number })?.status ?? 0),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SettingsProvider initial={initialSettings}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <RealtimeBridge />
            <CallProvider><GroupCallProvider>{children}</GroupCallProvider></CallProvider>
            <ThemedToaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

function ThemedToaster(props: React.ComponentProps<typeof Toaster>) {
  const [theme] = useTheme();
  return <Toaster theme={theme} {...props} />;
}
