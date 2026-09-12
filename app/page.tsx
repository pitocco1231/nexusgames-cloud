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

const details: Record<string, { delivery: string; region: string; note: string }> = {
  "mobile-legends": { delivery: "Recarga por Player ID", region: "Brasil", note: "Você confirma sua conta antes de pagar." },
  playstation: { delivery: "Código digital", region: "Brasil", note: "Ativação na PlayStation Store." },
  xbox: { delivery: "Código digital", region: "Brasil", note: "Gift cards e Game Pass conforme estoque." },
  minecraft: { delivery: "Código digital", region: "Compatível", note: "Minecoins e versões do jogo." },
  roblox: { delivery: "Gift card / código", region: "Em validação", note: "Só liberamos quando a região estiver segura." },
  valorant: { delivery: "Código Riot", region: "Em validação", note: "VP e cartões Riot quando disponíveis." },
  steam: { delivery: "Steam Wallet", region: "Em validação", note: "Créditos e códigos compatíveis com a região." }
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";
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
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <div className="heroContent heroReveal">
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
        <div className="heroShowcase heroRevealDelay">
          <div className="showcaseOrb" />
          <div className="heroVisualMain">
            <img src={images["mobile-legends"]} alt="Mobile Legends" />
            <div className="heroVisualOverlay" />
            <div className="heroVisualCaption">
              <span>MAIS VENDIDO</span>
              <strong>Mobile Legends</strong>
              <small>Diamantes • Brasil • Recarga por Player ID</small>
              <div className="heroInfoChips"><b>✓ Conta validada</b><b>⚡ Entrega automática</b></div>
            </div>
          </div>
          <div className="floatingMini miniPs"><img src={images.playstation} alt="PlayStation" /></div>
          <div className="floatingMini miniXbox"><img src={images.xbox} alt="Xbox" /></div>
          <div className="floatingMini miniMine"><img src={images.minecraft} alt="Minecraft" /></div>
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
              <article className={`gameCard ${available ? "isLive" : "isSoon"} animatedCard`} key={product.id}>
                <div className="gameImage">
                  <img src={images[product.id]} alt={product.name.replace("🔥 ", "")} loading="lazy" />
                  <div className="gameShade" />
                  <span className={available ? "liveTag" : "soonTag"}>{available ? "DISPONÍVEL" : "EM BREVE"}</span>
                </div>
                <div className="gameBody">
                  <div>
                    <span className="gameEmoji">{product.emoji}</span>
                    <h3>{product.name.replace("🔥 ", "")}</h3>
                  </div>
                  <p>{labels[product.id] || product.description}</p>
                  <div className="gameMeta">
                    <span>⚡ {details[product.id]?.delivery}</span>
                    <span>🌎 {details[product.id]?.region}</span>
                  </div>
                  <small className="gameNote">{details[product.id]?.note}</small>
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

      <section className="explainSection">
        <div className="sectionHeading">
          <span>ANTES DE COMPRAR</span>
          <h2>Você sabe exatamente o que vai receber.</h2>
          <p>Nada de produto confuso. Cada opção mostra região, forma de entrega e disponibilidade antes do pagamento.</p>
        </div>
        <div className="explainGrid">
          <article>
            <div className="explainVisual"><img src={images["mobile-legends"]} alt="Mobile Legends" /></div>
            <div className="explainBody"><span>RECARGA DIRETA</span><h3>Mobile Legends</h3><p>Informe Player ID + Zone ID. Nós validamos a conta primeiro; só depois você segue para o Pix.</p><div><b>✓ Sem senha</b><b>✓ Brasil</b></div></div>
          </article>
          <article>
            <div className="explainVisual"><img src={images.playstation} alt="PlayStation" /></div>
            <div className="explainBody"><span>CÓDIGO DIGITAL</span><h3>PlayStation, Xbox e Minecraft</h3><p>Você recebe um código digital compatível com a oferta escolhida e acompanha o status do pedido no checkout.</p><div><b>✓ Código privado</b><b>✓ Região validada</b></div></div>
          </article>
          <article>
            <div className="explainVisual tripleVisual">
              <img src={images.roblox} alt="Roblox" />
              <img src={images.valorant} alt="Valorant" />
              <img src={images.steam} alt="Steam" />
            </div>
            <div className="explainBody"><span>EM EXPANSÃO</span><h3>Roblox, Valorant e Steam</h3><p>Essas categorias aparecem na loja, mas só ficam compráveis quando encontramos estoque seguro e região compatível.</p><div><b>✓ Sem venda arriscada</b><b>✓ Catálogo automático</b></div></div>
          </article>
        </div>
      </section>

      <section className="howSection" id="como-funciona">
        <div className="sectionHeading compact">
          <span>SEM COMPLICAÇÃO</span>
          <h2>Da escolha à entrega.</h2>
        </div>
        <div className="howGrid">
          <div><b>01</b><span>🎮</span><h3>Escolha</h3><p>Entre no jogo, compare as opções e veja o preço atualizado.</p></div>
          <div><b>02</b><span>✅</span><h3>Validação</h3><p>Checamos estoque, região e, quando necessário, os dados da sua conta.</p></div>
          <div><b>03</b><span>💠</span><h3>Pix</h3><p>O QR Code aparece no checkout. O Mercado Pago confirma o pagamento.</p></div>
          <div><b>04</b><span>⚡</span><h3>Entrega</h3><p>O pedido muda de status automaticamente até a entrega do produto.</p></div>
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
