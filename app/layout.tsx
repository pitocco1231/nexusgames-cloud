import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./premium.css";
import "./rebuild-shell.css";
import "./rebuild-market.css";
import "./rebuild-pages.css";
import "./rebuild-responsive.css";
import "./final-design.css";
import ScrollReveal from "./ScrollReveal";

export const metadata: Metadata = {
  title: {
    default: "NexusGames | Games, recargas e gift cards",
    template: "%s | NexusGames"
  },
  description: "Recargas, gift cards e produtos digitais com Pix, disponibilidade verificada e suporte pelo Discord.",
  icons: { icon: "/assets/nexus-logo", apple: "/assets/nexus-logo" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "NexusGames",
    description: "Recargas, gift cards e produtos digitais em uma experiência rápida e segura.",
    type: "website",
    locale: "pt_BR"
  },
  twitter: {
    card: "summary",
    title: "NexusGames",
    description: "Games, recargas e gift cards com Pix e suporte pelo Discord."
  }
};

export const viewport: Viewport = {
  themeColor: "#06070b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><ScrollReveal />{children}</body>
    </html>
  );
}
