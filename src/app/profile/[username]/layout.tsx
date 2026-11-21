import type { Metadata } from "next";
import { getProfile, jsonLd, SITE_URL, snippet } from "@/lib/seo";

type Props = { params: Promise<{ username: string }>; children: React.ReactNode };

/**
 * Profile metadata is generated from the PUBLIC view of the profile (unauthenticated fetch),
 * so locked profiles only ever expose name, username and profile picture.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await getProfile(username);
  if (!u) return { title: "Profile not found", robots: { index: false, follow: false } };

  const title = `${u.displayName} (@${u.username})`;
  const description = u.bio
    ? snippet(u.bio)
    : u.restricted
      ? `${u.displayName} is on DualSphere. Their profile is locked.`
      : `See posts, photos and friends from ${u.displayName} on DualSphere.`;
  const url = `/profile/${u.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      username: u.username,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfileLayout({ params, children }: Props) {
  const { username } = await params;
  const u = await getProfile(username);
  return (
    <>
      {u && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url: `${SITE_URL}/profile/${u.username}`,
            dateCreated: u.createdAt,
            mainEntity: {
              "@type": "Person",
              name: u.displayName,
              alternateName: `@${u.username}`,
              identifier: u.username,
              ...(u.bio ? { description: u.bio } : {}),
              ...(u.avatarUrl ? { image: u.avatarUrl } : {}),
              url: `${SITE_URL}/profile/${u.username}`,
            },
          })}
        />
      )}
      {children}
    </>
  );
}
