import type { Metadata, Viewport } from "next";
import "./globals.css";
import ScrollReveal from "./ScrollReveal";

export const metadata: Metadata = {
  title: "NexusGames | Games, créditos e gift cards",
  description: "Compre produtos digitais para seus jogos favoritos com Pix, preços atualizados e suporte pelo Discord.",
  icons: { icon: "/assets/nexus-logo" },
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800" rel="stylesheet" />
      </head>
      <body><ScrollReveal />{children}</body>
    </html>
  );
}
