import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
              "radial-gradient(circle at 12% 10%, rgba(255,255,255,0.92), transparent 36%), radial-gradient(circle at 88% 16%, rgba(82,110,170,0.25), transparent 32%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 22,
            display: "flex",
            border: "1px solid rgba(29,34,48,0.18)",
            background: "rgba(255,255,255,0.34)",
            boxShadow: "0 14px 34px rgba(82,110,170,0.22)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            fontSize: 64,
            lineHeight: 0.9,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          MQ
        </div>
      </div>
    ),
    size,
  );
}
