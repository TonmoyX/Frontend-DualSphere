"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { EmptyState, RoleBadge, UserAvatar, VerifiedMark } from "@/components/common/bits";
import { PostList } from "@/components/post/feed";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q")?.trim() ?? "";
  const [text, setText] = useState(q);

  const users = useQuery({
    queryKey: ["search-users", q],
    queryFn: () => get<{ users: PublicUser[] }>(`/users?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(text.trim())}`); }} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search people and posts…" className="h-11 pl-9" />
      </form>

      {!q && <EmptyState icon={<Search className="size-8" />} title="Search DualSphere">Find people by name or username, and posts by keyword.</EmptyState>}

      {q && (
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">People</h2>
            {users.data?.users.length ? (
              <div className="divide-y rounded-2xl border bg-card">
                {users.data.users.map((u) => (
                  <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50">
                    <UserAvatar src={u.avatarUrl} name={u.displayName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium">{u.displayName} {u.isVerified && <VerifiedMark />} <RoleBadge role={u.role} /></div>
                      <div className="truncate text-sm text-muted-foreground">@{u.username}{u.bio ? ` · ${u.bio}` : ""}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{users.isLoading ? "Searching…" : "No people found."}</p>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">Posts</h2>
            <PostList key={q} queryKey={["feed", "search", q]} path={`/feed?mode=all&q=${encodeURIComponent(q)}`} empty={<p className="text-sm text-muted-foreground">No posts match “{q}”.</p>} />
          </section>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><SearchInner /></Suspense>;
}
