import { ImageResponse } from "next/og";
import { clip, drawable, inlineImage, OG_SIZE, OgAvatar, OgIcon, OgLogo, OgVerified } from "@/lib/og";
import { getPost, getSiteSettings } from "@/lib/seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Post on DualSphere";

/**
 * Per-post link preview (Facebook, WhatsApp, Messenger, X…): the post's photo or video,
 * who posted it and the text. Anonymous posts never show an author.
 */
export default async function PostOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, s] = await Promise.all([getPost(id), getSiteSettings()]);
  const site = s?.site.name ?? "DualSphere";

  if (!p) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg,#0a0a0f,#1b1740)", color: "white" }}>
        <OgLogo name={site} />
        <div style={{ fontSize: 60, fontWeight: 800 }}>This post isn&apos;t available</div>
      </div>,
      size,
    );
  }

  const src = p.isShare && p.sharedPost ? p.sharedPost : p; // a share previews the original's media
  const anon = p.visibility === "anonymous" || !p.author;
  const who = anon ? "Anonymous" : p.author!.displayName;
  const text = p.content || src.content || (src.postType === "avatar_update" ? `${who} updated their profile picture` : "");
  const imgMedia = src.media.find((m) => m.type === "image" && drawable(m.url, m.mime));
  const [image, avatar] = await Promise.all([inlineImage(imgMedia?.url), anon ? null : inlineImage(p.author!.avatarUrl)]);
  const video = !image && src.media.some((m) => m.type === "video");
  const count = src.media.filter((m) => m.type === "image" || m.type === "video").length;
  const accent = anon ? "linear-gradient(135deg,#f59e0b,#f97316,#f43f5e)" : "linear-gradient(135deg,#7c3aed,#d946ef,#ec4899)";

  const author = (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      {anon ? (
        <div style={{ width: 72, height: 72, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: accent }}>{OgIcon.mask(44)}</div>
      ) : (
        <OgAvatar src={avatar} name={who} size={72} ring="rgba(255,255,255,0.9)" />
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 34, fontWeight: 800 }}>
          {who}
          {!anon && p.author!.isVerified && <OgVerified size={30} />}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.72)" }}>{anon ? "Anonymous post" : `@${p.author!.username}`}{p.isShare ? " · shared a post" : ""}</div>
      </div>
    </div>
  );

  // With a photo/video: text on the left, media on the right
  if (image || video) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0d0d14", color: "white" }}>
        <div style={{ width: 600, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56 }}>
          <OgLogo name={site} />
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {author}
            {text && <div style={{ display: "flex", fontSize: 38, lineHeight: 1.3, fontWeight: 600, color: "#ececf5" }}>{clip(text, 130)}</div>}
          </div>
          <div style={{ display: "flex", gap: 28, fontSize: 24, color: "#a1a1c2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{OgIcon.heart(28)} {p.likesCount}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{OgIcon.comment(28)} {p.commentsCount}</div>
            {count > 1 && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{OgIcon.images(28)} {count}</div>}
          </div>
        </div>
        <div style={{ width: 600, height: "100%", display: "flex", position: "relative", overflow: "hidden", background: video ? accent : "#000" }}>
          {image && (
             
            <img src={image} width={600} height={630} alt="" style={{ width: 600, height: 630, objectFit: "cover" }} />
          )}
          {video && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 150, height: 150, borderRadius: 999, background: "rgba(0,0,0,0.45)", border: "6px solid white", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 14 }}>
                <div style={{ width: 0, height: 0, borderTop: "34px solid transparent", borderBottom: "34px solid transparent", borderLeft: "56px solid white" }} />
              </div>
            </div>
          )}
          {count > 1 && <div style={{ position: "absolute", top: 28, right: 28, padding: "8px 18px", borderRadius: 999, background: "rgba(0,0,0,0.6)", fontSize: 26, fontWeight: 700 }}>+{count - 1}</div>}
        </div>
      </div>,
      size,
    );
  }

  // Text-only: big quote on the brand gradient
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: accent, color: "white" }}>
      <OgLogo name={site} dark={false} />
      <div style={{ fontSize: text.length > 120 ? 48 : 62, fontWeight: 800, lineHeight: 1.2, display: "flex" }}>“{clip(text || `${who} shared a post`, 170)}”</div>
      <div style={{ display: "flex", padding: "22px 28px", borderRadius: 28, background: "rgba(0,0,0,0.28)" }}>{author}</div>
    </div>,
    size,
  );
}
