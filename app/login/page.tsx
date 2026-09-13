import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = {
  title: "Entrar | NexusGames",
  description: "Acesse sua conta NexusGames."
};

export default function LoginPage() {
  return (
    <main className="nxAuthPage">
      <section className="nxAuthVisual">
        <img src="https://cdn.mos.cms.futurecdn.net/uJRCtKEsYWkK99GtkuUQ64.jpg" alt="NexusGames" />
        <div className="nxAuthVisualShade" />
        <div className="nxAuthVisualCopy">
          <span>NEXUSGAMES</span>
          <h2>Seu universo gamer,<br/>em um só lugar.</h2>
          <p>Compre, acompanhe seus pedidos e conte com nosso suporte quando precisar.</p>
          <div><b>⚡ Digital</b><b>🔒 Seguro</b><b>💠 Pix</b></div>
        </div>
      </section>

      <section className="nxAuthPanel">
        <Suspense fallback={<div className="nxAuthLoading">Carregando...</div>}>
          <LoginClient />
        </Suspense>
      </section>
    </main>
  );
}
