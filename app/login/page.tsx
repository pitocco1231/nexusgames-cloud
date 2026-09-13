import { Suspense } from "react";
import Image from "next/image";
import LoginClient from "./LoginClient";

export const metadata = {
  title: "Entrar",
  description: "Acesse sua conta NexusGames para acompanhar seus pedidos digitais."
};

export default function LoginPage() {
  return (
    <main className="nxAuthPage nxAuthPageV5">
      <section className="nxAuthVisual nxAuthVisualV5">
        <Image
          className="nxAuthStableBg"
          src="/nexus/login-store.webp"
          alt="Ambiente gamer da loja digital NexusGames"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
        />
        <div className="nxAuthVisualShade" />
        <div className="nxAuthVisualCopy">
          <span>NEXUSGAMES • ÁREA DO CLIENTE</span>
          <h2>Suas compras.<br/>Seu universo gamer.</h2>
          <p>Acompanhe pedidos, consulte suas entregas digitais e tenha suporte sempre por perto.</p>
          <div><b>⚡ Entrega digital</b><b>🔒 Acesso protegido</b><b>◉ Suporte no Discord</b></div>
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
