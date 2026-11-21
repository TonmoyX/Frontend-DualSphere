import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon: the DualSphere black-hole mark (event horizon, photon ring, accretion disk). */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", borderRadius: 112, position: "relative", overflow: "hidden" }}>
        {/* glow */}
        <div style={{ position: "absolute", width: 440, height: 440, borderRadius: 999, background: "radial-gradient(circle, rgba(251,146,60,0.55) 0%, rgba(234,88,12,0.22) 45%, rgba(0,0,0,0) 70%)" }} />
        {/* accretion disk (behind) */}
        <div style={{ position: "absolute", width: 470, height: 112, borderRadius: 999, border: "26px solid #f97316", transform: "rotate(-12deg)", boxShadow: "0 0 30px 6px rgba(253,186,116,0.7)" }} />
        {/* event horizon + photon ring */}
        <div style={{ position: "absolute", width: 230, height: 230, borderRadius: 999, background: "#000", border: "6px solid #fff3d6", boxShadow: "0 0 40px 10px rgba(253,186,116,0.85)" }} />
        {/* front of the disk: same ellipse with only its lower edge drawn, so it passes in front of the hole */}
        <div style={{ position: "absolute", width: 470, height: 112, borderRadius: 999, border: "26px solid #fb923c", borderTopColor: "rgba(0,0,0,0)", transform: "rotate(-12deg)" }} />
      </div>
    ),
    size,
  );
}
