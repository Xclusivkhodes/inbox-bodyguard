import { ImageResponse } from "next/og";

export const alt = "Inbox Bodyguard. The AI email assistant that can't be turned against you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0B",
          color: "#fafafa",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: "#a1a1aa" }}>
          Inbox Bodyguard
        </div>
        <div style={{ display: "flex", fontSize: 64, lineHeight: 1.05, letterSpacing: -1, maxWidth: 920 }}>
          The AI email assistant that cannot be turned against you.
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#D08BE3" }}>
          Guard on the way in. Guard again before any tool.
        </div>
      </div>
    ),
    { ...size },
  );
}
