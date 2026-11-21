import Link from "next/link";
import type { ReactNode } from "react";

/** Shared layout for Privacy / Terms / Cookies / Help / Guidelines pages. */
export function DocPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["/help", "Help Center"],
          ["/guidelines", "Guidelines"],
          ["/privacy", "Privacy"],
          ["/terms", "Terms"],
          ["/cookies", "Cookies"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border bg-card px-3 py-1 text-muted-foreground hover:text-foreground">{label}</Link>
        ))}
      </nav>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>}
      {intro && <p className="mt-4 text-lg text-muted-foreground">{intro}</p>}
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:font-sans [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-normal [&_li]:ml-5 [&_ul>li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground [&_ol]:space-y-1.5 [&_ol]:text-muted-foreground [&_ol>li]:list-decimal [&_code]:rounded [&_code]:bg-anon/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-anon [&_section]:scroll-mt-20">
        {children}
      </div>
    </article>
  );
}
