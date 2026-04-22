import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #eef3fb 0%, #cfdaf0 100%)",
          color: "#1d2230",
          fontFamily: "Georgia, 'Times New Roman', serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 12% 10%, rgba(255,255,255,0.92), transparent 34%), radial-gradient(circle at 88% 14%, rgba(82,110,170,0.22), transparent 32%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 58,
            right: 58,
            top: 58,
            bottom: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(29,34,48,0.18)",
            background: "rgba(255,255,255,0.34)",
            boxShadow: "0 24px 60px rgba(82,110,170,0.22)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 164,
              lineHeight: 0.9,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            MQ
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(29,34,48,0.62)",
            }}
          >
            Music Radar
          </div>
        </div>
      </div>
    ),
    size,
  );
}
