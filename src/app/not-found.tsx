import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 mb-3 text-3xl font-bold">Lost in the sphere</h1>
        <p className="mb-6 text-muted-foreground">This page doesn&apos;t exist, or it was removed.</p>
        <Button asChild><Link href="/feed">Back to the feed</Link></Button>
      </div>
    </div>
  );
}

