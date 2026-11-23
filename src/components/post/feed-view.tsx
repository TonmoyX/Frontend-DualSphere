"use client";

import { MailWarning, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/common/bits";
import { Suspense } from "react";
import { FeedModeSwitch, useFeedMode } from "@/components/post/feed-mode-switch";
import { toast } from "sonner";
import { PostList } from "@/components/post/feed";
import { SponsoredSidebar } from "@/components/ads/sponsored-card";
import { FriendRow } from "@/components/friends/friend-card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { get } from "@/lib/api";
import type { FriendCard } from "@/lib/types";
import { PostComposer } from "@/components/post/post-composer";
import { StoriesBar } from "@/components/stories/stories-bar";
import { Button } from "@/components/ui/button";
import { errorMessage, post } from "@/lib/api";
import type { FeedMode } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

export function FeedView() {
  return (
    <Suspense>
      <FeedViewInner />
    </Suspense>
  );
}

function FeedViewInner() {
  // Feed filter (URL ?mode=): left sidebar on large screens, a pill under the navbar on smaller ones
  const mode: FeedMode = useFeedMode();
  const { user } = useAuth();
  const { features } = useSettings();

  return (
    <div className="mx-auto grid max-w-[1680px] gap-6 px-4 pt-3 pb-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[280px_minmax(0,1fr)_320px] 2xl:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-[4.25rem]">
          <FeedModeSwitch vertical layoutId="feed-mode-side" />
        </div>
      </aside>

      <div className="mx-auto w-full max-w-[760px] space-y-4">
        {user && !user.isVerified && (
          <div className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-2.5 text-sm text-warning">
            <MailWarning className="size-4 shrink-0" />
            <span className="flex-1">
              Verify your email{features.requireEmailVerification ? " to start posting" : ""}. Check your inbox.
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => post("/auth/resend-verification").then(() => toast.success("Verification email sent")).catch((e) => toast.error(errorMessage(e)))}
            >
              Resend
            </Button>
          </div>
        )}

        {/* Phones & tablets: the filter sits right under the navbar */}
        <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
          <FeedModeSwitch compact layoutId="feed-mode-mobile" />
        </div>

        {mode === "communities" ? (
          // Posts go into a specific community, so there's no general composer here
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Posts from the communities you&apos;ve joined. To post, open a community.</p>
            <Link href="/communities" className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Communities</Link>
          </div>
        ) : (
          <>
            <PostComposer key={`composer-${mode}`} defaultMode={mode === "anonymous" ? "anonymous" : "identity"} />
            <StoriesBar />
          </>
        )}

        <PostList
          key={mode}
          queryKey={["feed", mode]}
          path={`/feed?mode=${mode}`}
          live
          mode={mode}
          trackSeen
          sponsored={mode !== "communities"}
          empty={mode === "communities" ? (
            <EmptyState icon={<UsersRound className="size-8" />} title="Nothing from your communities yet">
              <Link href="/communities" className="text-primary hover:underline">Find communities to join</Link>
            </EmptyState>
          ) : undefined}
        />
      </div>

      <aside className="hidden space-y-4 xl:block">
        <div className="sticky top-[4.25rem] space-y-4">
          <SponsoredSidebar />
          {user && <PeopleYouMayKnow />}
        </div>
      </aside>
    </div>
  );
}

function PeopleYouMayKnow() {
  const { data } = useQuery({
    queryKey: ["friends", "suggestions", "sidebar"],
    queryFn: async () => (await get<{ suggestions: FriendCard[] }>("/friends/suggestions?limit=4")).suggestions,
  });
  if (!data?.length) return null;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">People you may know</h3>
        <Link href="/friends?tab=suggestions" className="text-xs text-primary hover:underline">See all</Link>
      </div>
      <div className="space-y-4">
        {data.map((u) => <FriendRow key={u.id} u={u} status="none" />)}
      </div>
    </div>
  );
}
