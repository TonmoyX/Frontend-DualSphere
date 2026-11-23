import type { Metadata } from "next";
import { getPost, jsonLd, SITE_URL, snippet } from "@/lib/seo";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

/** Post metadata. Anonymous posts never expose an author — not in titles, OG tags or JSON-LD. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(id);
  if (!p) return { title: "Post not found", robots: { index: false, follow: false } };

  const anon = p.visibility === "anonymous" || !p.author;
  const who = anon ? "Anonymous" : p.author!.displayName;
  const text = p.postType === "avatar_update" ? `${who} updated their profile picture` : p.postType === "cover_update" ? `${who} updated their cover photo` : p.content ? snippet(p.content, 140) : `${who} shared a post`;
  const title = anon ? `Anonymous post: “${snippet(text, 60)}”` : `${who} on DualSphere: “${snippet(text, 60)}”`;
  const url = `/post/${p.id}`;
  return {
    title,
    description: text,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description: text,
      url,
      publishedTime: p.createdAt,
      ...(anon ? {} : { authors: [`${SITE_URL}/profile/${p.author!.username}`] }),
    },
    twitter: { card: "summary_large_image", title, description: text },
  };
}

export default async function PostLayout({ params, children }: Props) {
  const { id } = await params;
  const p = await getPost(id);
  const anon = !p || p.visibility === "anonymous" || !p.author;
  return (
    <>
      {p && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "SocialMediaPosting",
            url: `${SITE_URL}/post/${p.id}`,
            datePublished: p.createdAt,
            headline: snippet(p.content || "Post", 110),
            ...(p.content ? { articleBody: p.content } : {}),
            author: anon
              ? { "@type": "Person", name: "Anonymous" }
              : { "@type": "Person", name: p.author!.displayName, url: `${SITE_URL}/profile/${p.author!.username}` },
            ...(p.media.some((m) => m.type === "image") ? { image: p.media.filter((m) => m.type === "image").map((m) => m.url) } : {}),
            interactionStatistic: [
              { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.likesCount },
              { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.commentsCount },
            ],
          })}
        />
      )}
      {children}
    </>
  );
}
