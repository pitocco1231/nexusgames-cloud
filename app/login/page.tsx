import { Suspense } from "react";
import LoginClient from "./LoginClient";
import { NEXUS_HERO_BACKGROUND } from "../../lib/nexusHero";

export const metadata = {
  title: "Entrar",
  description: "Acesse sua conta NexusGames para acompanhar seus pedidos digitais."
};

export default function LoginPage() {
  return (
    <main className="nxAuthPage nxAuthPageV5">
      <section className="nxAuthVisual nxAuthVisualV5">
        <img className="nxAuthStableBg" src={NEXUS_HERO_BACKGROUND} alt="Experiência digital NexusGames" />
        <div className="nxAuthVisualShade" />
        <div className="nxAuthVisualCopy">
          <span>NEXUSGAMES • CONTA</span>
          <h2>Sua loja digital,<br/>também na sua conta.</h2>
          <p>Acompanhe pedidos, acesse entregas e mantenha seu histórico em um só lugar.</p>
          <div><b>⚡ Digital</b><b>🔒 Protegido</b><b>◉ Suporte</b></div>
        </div>
      </section>

      <section className="nxAuthPanel nxAuthPanelV5">
        <Suspense fallback={<div className="nxAuthLoading">Carregando acesso seguro...</div>}>
          <LoginClient />
        </Suspense>
      </section>
    </main>
  );
}
