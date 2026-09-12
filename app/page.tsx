import { products } from "../lib/catalog";
import { getLiveOptions } from "../lib/liveStore";

const images: Record<string, string> = {
  "mobile-legends": "/assets/mobile-legends",
  playstation: "/assets/playstation",
  xbox: "/assets/xbox",
  minecraft: "/assets/minecraft",
  roblox: "/assets/roblox",
  valorant: "/assets/valorant",
  steam: "/assets/steam"
};

const labels: Record<string, string> = {
  "mobile-legends": "Diamantes e recargas",
  playstation: "Gift cards PS Store",
  xbox: "Gift cards e Game Pass",
  minecraft: "Minecoins e Minecraft",
  roblox: "Robux e gift cards",
  valorant: "VP e gift cards Riot",
  steam: "Steam Wallet e jogos"
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "#";
  const live = await getLiveOptions().catch(() => []);
  const cheapest = new Map<string, number>();
  for (const row of live) {
    const current = cheapest.get(row.option.categoryId);
    if (current === undefined || row.salePriceBrl < current) cheapest.set(row.option.categoryId, row.salePriceBrl);
  }

  return (
    <main className="siteShell">
      <header className="siteNav">
        <a className="siteBrand" href="#"><span className="brandMark">N</span><span>NEXUS<span>GAMES</span></span></a>
        <nav className="siteLinks">
          <a href="#jogos">Jogos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href={discordInvite}>Suporte</a>
        </nav>
        <a className="navCta" href="#jogos">Ver produtos</a>
      </header>

      <section className="storeHero">
        <div className="heroGrid" />
        <div className="heroContent">
          <span className="heroBadge"><i /> LOJA ONLINE</span>
          <h1>Jogue mais.<br /><strong>Pague menos.</strong></h1>
          <p>Games, créditos e gift cards em uma experiência rápida, segura e sem enrolação.</p>
          <div className="heroActions">
            <a className="primaryButton" href="#jogos">Explorar loja <b>→</b></a>
            <a className="secondaryButton" href={discordInvite}>Falar no Discord</a>
          </div>
          <div className="trustRow">
            <span>⚡ Compra rápida</span>
            <span>🔐 Checkout privado</span>
            <span>💠 Pix Mercado Pago</span>
          </div>
        </div>
        <div className="heroShowcase">
          <div className="showcaseOrb" />
          <div className="floatingCard cardPs"><img src="/assets/playstation" alt="PlayStation" /></div>
          <div className="floatingCard cardXbox"><img src="/assets/xbox" alt="Xbox" /></div>
          <div className="floatingCard cardMine"><img src="/assets/minecraft" alt="Minecraft" /></div>
          <div className="heroDiamond">◆</div>
        </div>
      </section>

      <section className="quickTrust">
        <div><span>⚡</span><div><b>Entrega automatizada</b><small>Após a confirmação do pagamento</small></div></div>
        <div><span>🛡️</span><div><b>Pagamento seguro</b><small>Processado pelo Mercado Pago</small></div></div>
        <div><span>🎫</span><div><b>Suporte humano</b><small>Atendimento pelo Discord</small></div></div>
      </section>

      <section className="gamesSection" id="jogos">
        <div className="sectionHeading">
          <span>CATÁLOGO NEXUS</span>
          <h2>Escolha seu universo.</h2>
          <p>Produtos disponíveis aparecem com preço em tempo real. Categorias sem oferta segura ficam como “Em breve”.</p>
        </div>

        <div className="gameGrid">
          {products.map((product) => {
            const from = cheapest.get(product.id);
            const available = from !== undefined;
            return (
              <article className={`gameCard ${available ? "isLive" : "isSoon"}`} key={product.id}>
                <div className="gameImage">
                  <img src={images[product.id]} alt={product.name.replace("🔥 ", "")} />
                  <div className="gameShade" />
                  <span className={available ? "liveTag" : "soonTag"}>{available ? "DISPONÍVEL" : "EM BREVE"}</span>
                </div>
                <div className="gameBody">
                  <div>
                    <span className="gameEmoji">{product.emoji}</span>
                    <h3>{product.name.replace("🔥 ", "")}</h3>
                  </div>
                  <p>{labels[product.id] || product.description}</p>
                  {available ? (
                    <>
                      <small>A partir de</small>
                      <strong className="gamePrice">R$ {from!.toFixed(2).replace(".", ",")}</strong>
                      <a className="gameButton" href={`/categoria/${product.id}`}>Ver produtos <b>→</b></a>
                    </>
                  ) : (
                    <button className="gameButton disabled" disabled>Em breve</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="howSection" id="como-funciona">
        <div className="sectionHeading compact">
          <span>SEM COMPLICAÇÃO</span>
          <h2>Da escolha à entrega.</h2>
        </div>
        <div className="howGrid">
          <div><b>01</b><span>🎮</span><h3>Escolha</h3><p>Selecione o jogo e o produto que deseja.</p></div>
          <div><b>02</b><span>✅</span><h3>Confira</h3><p>Validamos preço, região e disponibilidade antes do Pix.</p></div>
          <div><b>03</b><span>💠</span><h3>Pague</h3><p>Finalize com Pix em um checkout protegido.</p></div>
          <div><b>04</b><span>⚡</span><h3>Receba</h3><p>Acompanhe seu pedido até a entrega.</p></div>
        </div>
      </section>

      <section className="discordBanner">
        <div>
          <span>PRECISA DE AJUDA?</span>
          <h2>Nosso Discord virou sua central de suporte.</h2>
          <p>Dúvidas, problemas com pedidos e atendimento ficam em um só lugar.</p>
        </div>
        <a className="primaryButton" href={discordInvite}>Abrir Discord <b>→</b></a>
      </section>

      <footer className="siteFooter">
        <div className="siteBrand"><span className="brandMark">N</span><span>NEXUS<span>GAMES</span></span></div>
        <p>Produtos digitais • Pagamento via Mercado Pago • Suporte pelo Discord</p>
      </footer>
    </main>
  );
}
