import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          background: "#0B0E13",
          color: "#EEF1F4",
          padding: 96,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#3CC2DD",
              color: "#0B0E13",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            MK
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
            MK<span style={{ color: "#3CC2DD" }}>Trading</span>
          </div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.15 }}>Trade with clarity.</div>
        <div style={{ fontSize: 24, color: "#94A3B8", maxWidth: 760 }}>
          A modern trading platform built around transparent pricing and clear risk information.
        </div>
      </div>
    ),
    { ...size },
  );
}
