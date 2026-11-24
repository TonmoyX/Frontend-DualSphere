"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError, get, post, refreshNow, SUSPENDED_EVENT } from "@/lib/api";
import { getSocket, reconnectSocket } from "@/lib/socket";
import type { SelfUser } from "@/lib/types";

interface AuthCtx {
  user: SelfUser | null;
  loading: boolean;
  setUser: (u: SelfUser | null) => void;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
  /** Signed in to a suspended account: every page shows the suspension screen instead. */
  suspended: boolean;
  setSuspended: (s: boolean) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [suspended, setSuspended] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await get<{ user: SelfUser }>("/auth/me")).user;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (err.code === "BANNED") setSuspended(true);
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
    setSuspended(false);
    setUser(null);
  }, [setUser]);

  // Any API call answering BANNED (e.g. suspended while browsing) → suspension screen
  useEffect(() => {
    const on = () => { setSuspended(true); qc.setQueryData(["me"], null); };
    window.addEventListener(SUSPENDED_EVENT, on);
    return () => window.removeEventListener(SUSPENDED_EVENT, on);
  }, [qc]);

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
      if (p?.reason === "banned") {
        // The session stays, limited to the suspension screen
        setSuspended(true);
        qc.setQueryData(["me"], null);
        return;
      }
      setUser(null);
      toast.warning("You've been signed out.");
    };
    s.on("session:revoked", onRevoked);
    return () => void s.off("session:revoked", onRevoked);
  }, [setUser, qc]);

  return <Ctx.Provider value={{ user: data ?? null, loading: isLoading, setUser, refetch, logout, suspended, setSuspended }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
