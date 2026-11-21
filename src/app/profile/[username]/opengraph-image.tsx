import { ImageResponse } from "next/og";
import { clip, inlineImage, OG_SIZE, OgAvatar, OgIcon, OgLogo, OgVerified } from "@/lib/og";
import { getProfile, getSiteSettings } from "@/lib/seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Profile on DualSphere";

/** Per-profile link preview: cover, profile photo, name, @username and bio (locked profiles show only name + photo). */
export default async function ProfileOgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [u, s] = await Promise.all([getProfile(username), getSiteSettings()]);
  const site = s?.site.name ?? "DualSphere";

  if (!u) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg,#0a0a0f,#1b1740)", color: "white" }}>
        <OgLogo name={site} />
        <div style={{ fontSize: 60, fontWeight: 800 }}>Profile not found</div>
      </div>,
      size,
    );
  }

  const [cover, avatar] = await Promise.all([u.restricted ? null : inlineImage(u.coverUrl), inlineImage(u.avatarUrl)]);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0d0d14", color: "white" }}>
      {/* Cover */}
      <div style={{ width: "100%", height: 280, display: "flex", position: "relative", background: "linear-gradient(135deg,#7c3aed,#d946ef 55%,#22d3ee)" }}>
        {cover && (
           
          <img src={cover} width={1200} height={280} alt="" style={{ width: 1200, height: 280, objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", top: 32, right: 40, display: "flex", padding: "10px 20px", borderRadius: 999, background: "rgba(0,0,0,0.45)" }}>
          <OgLogo name={site} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 36, padding: "0 64px", marginTop: -100 }}>
        <OgAvatar src={avatar} name={u.displayName} size={230} ring="#0d0d14" />
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 60, fontWeight: 800 }}>
            {clip(u.displayName, 24)}
            {u.isVerified && <OgVerified size={44} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 32, color: "#a1a1c2" }}>
            @{u.username}
            {u.restricted && <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>· {OgIcon.lock(26)} Locked profile</div>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", padding: "26px 64px 0", fontSize: 32, lineHeight: 1.35, color: "#d6d6e6" }}>
        {u.restricted ? `${u.displayName} is on ${site}.` : u.bio ? clip(u.bio, 120) : `See posts, photos and friends from ${u.displayName} on ${site}.`}
      </div>
    </div>,
    size,
  );
}
