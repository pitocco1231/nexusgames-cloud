import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusGames | Games, créditos e gift cards",
  description: "Compre produtos digitais para seus jogos favoritos com Pix, preços atualizados e suporte pelo Discord.",
  icons: { icon: "/assets/nexus-icon" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "NexusGames",
    description: "Games, créditos e gift cards em uma experiência simples e segura.",
    type: "website"
  }
};

export const viewport: Viewport = { themeColor: "#07070a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
