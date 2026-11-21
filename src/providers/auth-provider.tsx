"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError, get, post, refreshNow } from "@/lib/api";
import { getSocket, reconnectSocket } from "@/lib/socket";
import type { SelfUser } from "@/lib/types";

interface AuthCtx {
  user: SelfUser | null;
  loading: boolean;
  setUser: (u: SelfUser | null) => void;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await get<{ user: SelfUser }>("/auth/me")).user;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (err.code === "BANNED") {
            toast.error("Your account is suspended", { description: (err.details as { reason?: string })?.reason ?? undefined });
          }
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });

  const setUser = useCallback(
    (u: SelfUser | null) => {
      qc.setQueryData(["me"], u);
      reconnectSocket();
      // Viewer-specific fields (likedByMe / isOwner) change with identity
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "settings" });
    },
    [qc],
  );

  const logout = useCallback(async () => {
    await post("/auth/logout").catch(() => {});
    setUser(null);
  }, [setUser]);

  // Refresh the session every 10 min (access tokens live 15 min) so nothing silently degrades
  const loggedIn = !!data;
  useEffect(() => {
    if (!loggedIn) return;
    const t = setInterval(() => void refreshNow(), 10 * 60_000);
    return () => clearInterval(t);
  }, [loggedIn]);

  // Server-side revocation (ban, role change, password reset) → sign out instantly
  useEffect(() => {
    const s = getSocket();
    const onRevoked = (p: { reason?: string }) => {
      setUser(null);
      toast.warning(p?.reason === "banned" ? "Your account has been suspended." : "You've been signed out.");
    };
    s.on("session:revoked", onRevoked);
    return () => void s.off("session:revoked", onRevoked);
  }, [setUser]);

  return <Ctx.Provider value={{ user: data ?? null, loading: isLoading, setUser, refetch, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
