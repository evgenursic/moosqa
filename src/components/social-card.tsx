type SocialCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  footer?: string;
  imageSrc?: string | null;
};

export function SocialCard({
  eyebrow = "MooSQA beta",
  title = "New releases first.",
  description = "Fresh indie songs, albums, EPs and live sessions in one fast editorial feed.",
  footer = "moosqa-ci4e.vercel.app",
  imageSrc = null,
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

      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.22,
            filter: "blur(2px) saturate(0.92)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: imageSrc
            ? "linear-gradient(180deg, rgba(233,238,247,0.78) 0%, rgba(214,224,239,0.92) 100%)"
            : "transparent",
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
          gap: 34,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: imageSrc ? "1 1 0%" : "1 1 auto",
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
              maxWidth: imageSrc ? 620 : 960,
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

        {imageSrc ? (
          <div
            style={{
              display: "flex",
              position: "relative",
              width: 360,
              minWidth: 360,
              overflow: "hidden",
              border: "1px solid rgba(29,34,48,0.14)",
              boxShadow: "0 16px 40px rgba(20,28,40,0.18)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(12,18,28,0.08) 0%, rgba(12,18,28,0.82) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 22,
                right: 22,
                bottom: 22,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  fontFamily: "'Courier New', monospace",
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                {eyebrow}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  lineHeight: 1.05,
                  fontWeight: 600,
                }}
              >
                {title}
              </div>
            </div>
          </div>
        ) : null}
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
