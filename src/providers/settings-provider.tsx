"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { get } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { PublicSettings } from "@/lib/types";

export const FALLBACK_SETTINGS: PublicSettings = {
  site: {
    name: "DualSphere",
    tagline: "Be yourself. Or be no one.",
    description: "A dual-mode social platform.",
    logoUrl: null,
    footerText: "© DualSphere",
    announcement: { enabled: false, text: "", variant: "info", link: null },
  },
  features: {
    registrationEnabled: true,
    anonymousPostingEnabled: true,
    commentsEnabled: true,
    mediaUploadsEnabled: true,
    messagingEnabled: true,
    videoUploadsEnabled: true,
    requireEmailVerification: false,
    maintenanceMode: false,
    maintenanceMessage: "",
  },
  limits: { maxPostLength: 2000, maxCommentLength: 500, maxMediaPerPost: 4, maxImageMb: 10, maxVideoMb: 100, anonAccountAgeHours: 24 },
};

const Ctx = createContext<PublicSettings>(FALLBACK_SETTINGS);

/** Admin-controlled site settings. Updates are pushed live over Socket.io. */
export function SettingsProvider({ children, initial }: { children: ReactNode; initial: PublicSettings | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => get<PublicSettings>("/settings/public"),
    initialData: initial ?? undefined,
    staleTime: 60_000,
  });

  useEffect(() => {
    const s = getSocket();
    const onUpdate = (next: PublicSettings) => qc.setQueryData(["settings"], next);
    s.on("settings:update", onUpdate);
    return () => void s.off("settings:update", onUpdate);
  }, [qc]);

  return <Ctx.Provider value={data ?? FALLBACK_SETTINGS}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
