"use client";

import { AuthLanding } from "@/components/auth/auth-landing";
import { Spinner } from "@/components/common/bits";
import { FeedView } from "@/components/post/feed-view";
import { useAuth } from "@/providers/auth-provider";

/** Logged out → log-in page. Logged in → the feed (like Facebook's home). */
export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[70vh] place-items-center"><Spinner className="size-6 text-muted-foreground" /></div>;
  return user ? <FeedView /> : <AuthLanding />;
}
