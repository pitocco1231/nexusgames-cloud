import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusGames | Games, créditos e gift cards",
  description: "Compre produtos digitais para seus jogos favoritos com Pix, preços atualizados e suporte pelo Discord.",
  themeColor: "#07080d",
  robots: { index: true, follow: true },
  openGraph: {
    title: "NexusGames",
    description: "Jogue mais. Pague menos.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
