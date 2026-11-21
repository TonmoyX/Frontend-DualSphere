"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EmptyState, Spinner } from "@/components/common/bits";
import { PostList } from "@/components/post/feed";
import { useAuth } from "@/providers/auth-provider";

/** Your saved posts, newest saves first. Private to you. */
export default function SavedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/saved");
  }, [loading, user, router]);

  if (!user) return <Spinner className="mx-auto mt-16 block size-6 text-muted-foreground" />;

  return (
    <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30">
          <Bookmark className="size-5 fill-current" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Saved</h1>
          <p className="text-sm text-muted-foreground">Only you can see what you&apos;ve saved.</p>
        </div>
      </div>
      <PostList
        queryKey={["saved"]}
        path="/feed/saved"
        empty={
          <EmptyState icon={<Bookmark className="size-8" />} title="No saved posts yet">
            Tap <span className="font-medium">⋯ → Save post</span> on anything you want to come back to.{" "}
            <Link href="/" className="font-medium text-primary hover:underline">Browse the feed</Link>
          </EmptyState>
        }
      />
    </div>
  );
}
