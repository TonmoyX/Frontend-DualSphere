"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common/bits";
import { GroupsIcon } from "@/components/common/groups-icon";
import { ANON_POLICY, CommunityCard, VISIBILITY } from "@/components/community/community-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, get, post } from "@/lib/api";
import type { AnonPolicy, Community, CommunityListItem, CommunityVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 32);

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; hint: string }[] }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded-xl border-2 p-2.5 text-left transition-colors", value === o.v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border")}
        >
          <span className="block text-sm font-semibold">{o.label}</span>
          <span className="block text-xs text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function CreateCommunityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CommunityVisibility>("public");
  const [anonPolicy, setAnonPolicy] = useState<AnonPolicy>("allowed");
  const [postApproval, setPostApproval] = useState(false);

  // The link follows the name until you edit it yourself
  const slug = slugTouched ? customSlug : slugify(name);
  const slugOk = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug) && !slug.includes("--");

  const create = useMutation({
    mutationFn: () => post<{ community: Community }>("/communities", { name, slug, description, visibility, anonPolicy, postApproval }),
    onSuccess: ({ community }) => {
      toast.success(`${community.name} is ready`);
      onOpenChange(false);
      router.push(`/c/${community.slug}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a community</DialogTitle>
          <DialogDescription>You&apos;ll be the owner. You can change everything except the link later.</DialogDescription>
        </DialogHeader>
        <form id="create-community" className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Name</Label>
            <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. DU CSE Batch 22" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-slug">Link</Label>
            <div className="flex items-center rounded-lg border focus-within:ring-3 focus-within:ring-ring/50">
              <span className="pl-3 text-sm text-muted-foreground">dualsphere/c/</span>
              <input
                id="cc-slug"
                value={slug}
                onChange={(e) => { setSlugTouched(true); setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32)); }}
                className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
              />
            </div>
            {slug && !slugOk && <p className="text-xs text-destructive">3–32 lowercase letters, numbers or single dashes; no dash at the start or end.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-desc">Description</Label>
            <Textarea id="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-20" placeholder="What is this community about?" />
          </div>
          <div className="space-y-1.5">
            <Label>Who can see it?</Label>
            <Choice value={visibility} onChange={setVisibility} options={(Object.keys(VISIBILITY) as CommunityVisibility[]).map((v) => ({ v, label: VISIBILITY[v].label, hint: VISIBILITY[v].hint }))} />
          </div>
          <div className="space-y-1.5">
            <Label>How can members post?</Label>
            <Choice value={anonPolicy} onChange={setAnonPolicy} options={(Object.keys(ANON_POLICY) as AnonPolicy[]).map((v) => ({ v, ...ANON_POLICY[v] }))} />
            <p className="text-xs text-muted-foreground">Anonymous posts never show who wrote them — not even to you or your moderators.</p>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-medium">Approve posts before they appear</span>
              <span className="block text-xs text-muted-foreground">Posts by members wait until you or a moderator approves them</span>
            </span>
            <Switch checked={postApproval} onCheckedChange={setPostApproval} />
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" form="create-community" disabled={create.isPending || name.trim().length < 3 || !slugOk}>
            {create.isPending && <Spinner />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Debounced search
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const mine = useQuery({ queryKey: ["communities", "mine", user?.id], queryFn: () => get<{ communities: CommunityListItem[] }>("/communities/mine"), enabled: !!user });
  const discover = useInfiniteQuery({
    queryKey: ["communities", "discover", term, user?.id ?? "anon"],
    queryFn: ({ pageParam }) => get<{ communities: CommunityListItem[]; hasMore: boolean }>(`/communities?page=${pageParam}&limit=24${term ? `&q=${encodeURIComponent(term)}` : ""}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
  });
  const list = discover.data?.pages.flatMap((p) => p.communities) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><GroupsIcon className="size-7 text-primary" /> Communities</h1>
          <p className="text-sm text-muted-foreground">Spaces with their own rules. Post as yourself or anonymously, where the community allows it.</p>
        </div>
        <Button onClick={() => (user ? setCreateOpen(true) : router.push("/login?next=/communities"))}><Plus /> Create community</Button>
      </div>

      {user && !!mine.data?.communities.length && !term && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Your communities</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mine.data.communities.map((c) => <CommunityCard key={c.id} c={c} />)}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{term ? `Results for “${term}”` : "Discover"}</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Search communities" className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        {discover.isLoading && <div className="grid place-items-center py-10"><Spinner className="size-6" /></div>}
        {!discover.isLoading && list.length === 0 && (
          <EmptyState icon={<UsersRound className="size-8" />} title={term ? "No communities match" : "No communities yet"}>
            {user ? <button type="button" className="text-primary hover:underline" onClick={() => setCreateOpen(true)}>Start the first one</button> : <Link href="/login" className="text-primary hover:underline">Log in to create one</Link>}
          </EmptyState>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => <CommunityCard key={c.id} c={c} />)}
        </div>
        {discover.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => discover.fetchNextPage()} disabled={discover.isFetchingNextPage}>
              {discover.isFetchingNextPage && <Spinner />} Show more
            </Button>
          </div>
        )}
      </section>

      {user && <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}
