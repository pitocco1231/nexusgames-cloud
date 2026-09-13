import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = {
  title: "Entrar | NexusGames",
  description: "Acesse sua conta NexusGames."
};

export default function LoginPage() {
  return (
    <main className="nxAuthPage">
      <section className="nxAuthVisual nxAuthVisualStable">
        <img className="nxAuthStableBg" src="https://images.unsplash.com/photo-1767800766429-7179fd80948f?auto=format&fit=crop&fm=jpg&q=88&w=1800" alt="Ambiente gamer NexusGames" />
        <div className="nxAuthVisualShade" />
        <div className="nxAuthVisualCopy">
          <span>NEXUSGAMES STORE</span>
          <h2>Seu universo gamer,<br/>em um só lugar.</h2>
          <p>Games, gift cards e recargas reunidos em uma experiência própria da NexusGames.</p>
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
