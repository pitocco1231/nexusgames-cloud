import StoreExplorer from "./StoreExplorer";
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

const shortDescriptions: Record<string, string> = {
  "mobile-legends": "Diamantes MLBB com recarga direta.",
  playstation: "Gift cards para PlayStation Store.",
  xbox: "Gift cards Xbox e Game Pass.",
  minecraft: "Minecraft e Minecoins digitais.",
  roblox: "Robux e gift cards Roblox.",
  valorant: "VP e gift cards Riot.",
  steam: "Steam Wallet e produtos para PC."
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";
  const live = await getLiveOptions().catch(() => []);

  const categoryPrice = new Map<string, number>();
  for (const row of live) {
    const current = categoryPrice.get(row.option.categoryId);
    if (current === undefined || row.salePriceBrl < current) categoryPrice.set(row.option.categoryId, row.salePriceBrl);
  }

  const categories = products.map((product) => ({
    id: product.id,
    name: product.name.replace("🔥 ", ""),
    description: shortDescriptions[product.id] || product.description,
    image: images[product.id] || "/assets/nexus-icon",
    available: categoryPrice.has(product.id),
    fromPrice: categoryPrice.get(product.id) ?? null
  }));

  const items = live.map((row) => {
    const category = products.find((product) => product.id === row.option.categoryId);
    return {
      id: row.option.id,
      categoryId: row.option.categoryId,
      categoryName: category?.name.replace("🔥 ", "") || row.option.categoryId,
      name: row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim(),
      description: row.option.description,
      price: row.salePriceBrl,
      emoji: row.option.emoji,
      href: \`/checkout?produto=\${encodeURIComponent(row.option.id)}\`
    };
  });

  const heroPrice = categoryPrice.get("mobile-legends");

  return (
    <main className="marketShell">
      <header className="marketNav">
        <a href="/" className="marketLogo">
          <img src="/assets/nexus-icon" alt="NexusGames" />
          <div><strong>NEXUS</strong><span>GAMES</span></div>
        </a>

        <a href="#catalogo" className="marketNavSearch">
          <span>⌕</span>
          <b>Buscar jogos, gift cards e recargas</b>
          <kbd>/</kbd>
        </a>

        <nav>
          <a href="#categorias">Categorias</a>
          <a href="#como-funciona">Como comprar</a>
          <a href={discordInvite} target="_blank" rel="noreferrer">Suporte</a>
        </nav>
      </header>

      <div className="marketTopline">
        <span>⚡ Produtos digitais</span>
        <span>🔒 Checkout protegido</span>
        <span>💠 Pix Mercado Pago</span>
        <span>🎫 Suporte no Discord</span>
      </div>

      <section className="marketHero">
        <div className="marketGlow glowPurple" />
        <div className="marketGlow glowBlue" />
        <div className="marketHeroCopy">
          <span className="marketEyebrow">NEXUSGAMES • LOJA DIGITAL</span>
          <h1>Seu próximo item<br /><em>está a um Pix.</em></h1>
          <p>Créditos, gift cards e recargas para seus jogos favoritos, com preços atualizados e compra simples.</p>
          <div className="marketHeroActions">
            <a className="marketPrimary" href="#catalogo">Ver ofertas <b>→</b></a>
            <a className="marketSecondary" href={discordInvite} target="_blank" rel="noreferrer">Discord</a>
          </div>
          <div className="marketMiniStats">
            <div><b>100%</b><span>digital</span></div>
            <div><b>Pix</b><span>via Mercado Pago</span></div>
            <div><b>24/7</b><span>catálogo online</span></div>
          </div>
        </div>

        <a className="marketHeroDeal" href="/categoria/mobile-legends">
          <img src="/assets/mobile-legends" alt="Mobile Legends" />
          <div className="marketHeroDealShade" />
          <div className="marketHeroDealTop"><span>🔥 DESTAQUE</span><b>Mobile Legends</b></div>
          <div className="marketHeroDealBottom">
            <div><small>Diamantes MLBB</small><strong>{heroPrice ? \`a partir de R$ \${heroPrice.toFixed(2).replace(".", ",")}\` : "Veja as ofertas"}</strong></div>
            <span>Explorar →</span>
          </div>
        </a>

        <a className="marketFloatCard floatPs" href="/categoria/playstation"><img src="/assets/playstation" alt="PlayStation" /><span>PlayStation</span></a>
        <a className="marketFloatCard floatXbox" href="/categoria/xbox"><img src="/assets/xbox" alt="Xbox" /><span>Xbox</span></a>
      </section>

      <StoreExplorer items={items} categories={categories} />

      <section className="marketBenefits" id="como-funciona">
        <div className="marketSectionHead">
          <div><span>SIMPLES E RÁPIDO</span><h2>Como comprar</h2></div>
          <p>Você vê o preço antes, paga pelo checkout e acompanha o pedido.</p>
        </div>
        <div className="marketSteps">
          <article><b>01</b><span>🎮</span><h3>Escolha</h3><p>Selecione o jogo e o produto que você quer.</p></article>
          <article><b>02</b><span>✅</span><h3>Confira</h3><p>Preço, região e disponibilidade são validados.</p></article>
          <article><b>03</b><span>💠</span><h3>Pague</h3><p>Finalize com Pix pelo Mercado Pago.</p></article>
          <article><b>04</b><span>⚡</span><h3>Receba</h3><p>Acompanhe o status até a entrega digital.</p></article>
        </div>
      </section>

      <section className="marketDiscord">
        <div>
          <img src="/assets/nexus-icon" alt="NexusGames" />
          <div><span>PRECISA DE AJUDA?</span><h2>O Discord é nossa central de suporte.</h2><p>Dúvidas de pagamento, entrega e pedidos em um só lugar.</p></div>
        </div>
        <a href={discordInvite} target="_blank" rel="noreferrer">Abrir Discord →</a>
      </section>

      <footer className="marketFooter">
        <a href="/" className="marketLogo">
          <img src="/assets/nexus-icon" alt="NexusGames" />
          <div><strong>NEXUS</strong><span>GAMES</span></div>
        </a>
        <p>Produtos digitais • Pagamento seguro • Suporte pelo Discord</p>
        <div><a href="#catalogo">Loja</a><a href="#como-funciona">Como comprar</a><a href={discordInvite}>Suporte</a></div>
      </footer>
    </main>
  );
}
