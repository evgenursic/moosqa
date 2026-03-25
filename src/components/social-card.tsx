type SocialCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  footer?: string;
};

export function SocialCard({
  eyebrow = "MooSQA beta",
  title = "New releases first.",
  description = "Fresh indie songs, albums, EPs and live sessions in one fast editorial feed.",
  footer = "moosqa-ci4e.vercel.app",
}: SocialCardProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "58px 64px",
        background:
          "linear-gradient(180deg, #e9eef7 0%, #d6e0ef 100%)",
        color: "#1d2230",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.95), transparent 34%), radial-gradient(circle at top right, rgba(143,167,212,0.22), transparent 28%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: -90,
          top: -60,
          width: 320,
          height: 320,
          borderRadius: 999,
          background: "rgba(82,110,170,0.10)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: -120,
          bottom: -140,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: "rgba(128,148,190,0.13)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(29,34,48,0.58)",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {eyebrow}
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 92,
                lineHeight: 0.9,
                fontWeight: 600,
              }}
            >
              MooSQA
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10,
              marginTop: 8,
              fontFamily: "'Courier New', monospace",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: "0.46em",
                textTransform: "uppercase",
                color: "rgba(29,34,48,0.6)",
              }}
            >
              Music Radar
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(29,34,48,0.38)",
              }}
            >
              Fresh indie discovery
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 1,
            background: "rgba(29,34,48,0.16)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 960,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 0.95,
              fontWeight: 500,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 34,
              lineHeight: 1.28,
              color: "rgba(29,34,48,0.76)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {description}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginTop: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#526eaa",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(29,34,48,0.72)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Free listening links + community ratings
          </div>
        </div>

        <div
          style={{
            display: "flex",
            padding: "18px 22px",
            border: "1px solid rgba(29,34,48,0.16)",
            background: "rgba(255,255,255,0.65)",
            fontSize: 24,
            letterSpacing: "0.14em",
            color: "#1d2230",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
