"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Megaphone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, Spinner } from "@/components/common/bits";
import { type Business, BusinessLogo, PageBadgeIcon, VerificationBadge } from "@/components/ads/ads-bits";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/api";

/** Public business page — the identity every Sponsored post runs under. */
export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({ queryKey: ["business", slug], queryFn: () => get<{ business: Business }>(`/business/${slug}`) });
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  if (error || !data) return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Business not found" /></div>;
  const b = data.business;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <BusinessLogo b={b} className="size-16 text-2xl" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold break-words">{b.name} <PageBadgeIcon badge={b.badge} withLabel /></h1>
            <p className="text-sm capitalize text-muted-foreground">{b.category.replace("_", " & ")}</p>
            {b.role && <VerificationBadge v={b.verification} />}
          </div>
        </div>
        {b.description && <p className="mt-4 text-[15px] whitespace-pre-wrap">{b.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {b.website && <Button variant="secondary" size="sm" asChild><a href={b.website} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink /> Website</a></Button>}
          {b.role && b.role !== "analyst" && <Button size="sm" asChild><Link href={`/ads?b=${b.id}`}><Megaphone /> Ads Manager</Link></Button>}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Ads from this business are labelled “Sponsored”. Only business pages approved by DualSphere can run ads.</p>
      </div>
    </div>
  );
}
