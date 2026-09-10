import { ImageResponse } from "next/og";

const bannerConfig: Record<string, { title: string; subtitle: string; symbol: string }> = {
  roblox: { title: "ROBLOX", subtitle: "ROBLOX • DIGITAL", symbol: "R" },
  valorant: { title: "VALORANT", subtitle: "POINTS • DIGITAL", symbol: "V" },
  steam: { title: "STEAM", subtitle: "WALLET • PC • KEYS", symbol: "S" },
  minecraft: { title: "MINECRAFT", subtitle: "JAVA + BEDROCK", symbol: "M" },
  xbox: { title: "XBOX", subtitle: "GAME PASS • DIGITAL", symbol: "X" },
  playstation: { title: "PLAYSTATION", subtitle: "GIFT CARDS • DIGITAL", symbol: "P" },
  ofertas: { title: "OFERTAS", subtitle: "PROMOÇÕES • NEXUSGAMES", symbol: "%" },
  suporte: { title: "SUPORTE", subtitle: "ATENDIMENTO • NEXUSGAMES", symbol: "?" }
};

export function createBannerResponse(name: string) {
  const item = bannerConfig[name] || {
    title: "NEXUSGAMES",
    subtitle: "DIGITAL GAMING STORE",
    symbol: "N"
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          overflow: "hidden",
          background: "linear-gradient(115deg, #090611 0%, #160a2b 45%, #34106d 100%)",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            borderRadius: 999,
            right: -120,
            top: -230,
            background: "radial-gradient(circle, rgba(168,85,247,.62) 0%, rgba(124,58,237,.12) 58%, rgba(0,0,0,0) 72%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 430,
            height: 430,
            borderRadius: 999,
            left: -180,
            bottom: -260,
            background: "radial-gradient(circle, rgba(99,102,241,.55) 0%, rgba(76,29,149,.08) 62%, rgba(0,0,0,0) 74%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 46,
            top: 34,
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: 0.92
          }}
        >
          <div
            style={{
              display: "flex",
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, #a855f7, #6d28d9)",
              fontSize: 19,
              fontWeight: 900
            }}
          >
            N
          </div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>
            NEXUSGAMES
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 38,
            marginLeft: 82,
            marginTop: 42
          }}
        >
          <div
            style={{
              display: "flex",
              width: 150,
              height: 150,
              borderRadius: 38,
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(216,180,254,.6)",
              background: "linear-gradient(145deg, rgba(168,85,247,.38), rgba(76,29,149,.34))",
              boxShadow: "0 0 50px rgba(168,85,247,.25)",
              fontSize: 76,
              lineHeight: 1,
              fontWeight: 900,
              textShadow: "0 0 24px rgba(216,180,254,.55)"
            }}
          >
            {item.symbol}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                fontSize: item.title.length > 10 ? 64 : 78,
                fontWeight: 900,
                letterSpacing: 3,
                lineHeight: 1
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                color: "#d8b4fe"
              }}
            >
              {item.subtitle}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                width: 390,
                height: 5,
                borderRadius: 999,
                background: "linear-gradient(90deg, #a855f7, #7c3aed, rgba(124,58,237,0))"
              }}
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 32,
            display: "flex",
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid rgba(216,180,254,.22)",
            background: "rgba(17,8,34,.58)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#e9d5ff"
          }}
        >
          DIGITAL • RÁPIDO • SEGURO
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 420,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Content-Type": "image/png"
      }
    }
  );
}
