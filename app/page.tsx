import HeaderActions from "./HeaderActions";
import StoreExplorer from "./StoreExplorer";
import { products } from "../lib/catalog";
import { getLiveOptions } from "../lib/liveStore";
import { NEXUS_HERO_BACKGROUND } from "../lib/nexusHero";
import { storeImage } from "../lib/storeMedia";
import { productImage } from "../lib/productMedia";

export const dynamic = "force-dynamic";

export default async function Home() {
  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";
  const live = await getLiveOptions().catch(() => []);

  const byCategory = new Map<string, number>();
  for (const row of live) {
    const current = byCategory.get(row.option.categoryId);
    if (current === undefined || row.salePriceBrl < current) byCategory.set(row.option.categoryId, row.salePriceBrl);
  }

  const categories = products.map((product) => ({
    id: product.id,
    name: product.name.replace("🔥 ", ""),
    description: product.description,
    image: storeImage(product.id),
    available: byCategory.has(product.id),
    fromPrice: byCategory.get(product.id) ?? null
  }));

  const items = live.map((row) => {
    const category = products.find((product) => product.id === row.option.categoryId);
    const brand = row.option.categoryId === "mobile-legends"
      ? { name: "MOBILE LEGENDS", mark: "ML", tone: "ml" }
      : row.option.categoryId === "minecraft"
        ? { name: "MINECRAFT", mark: "▣", tone: "mc" }
        : row.option.categoryId === "xbox"
          ? { name: "XBOX", mark: "X", tone: "xb" }
          : row.option.categoryId === "playstation"
            ? { name: "PLAYSTATION", mark: "PS", tone: "ps" }
            : { name: category?.name.replace("🔥 ", "") || "NEXUSGAMES", mark: "N", tone: "nx" };
    return {
      id: row.option.id,
      categoryId: row.option.categoryId,
      categoryName: category?.name.replace("🔥 ", "") || row.option.categoryId,
      name: row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim(),
      description: row.option.description,
      price: row.salePriceBrl,
      emoji: row.option.emoji,
      image: productImage(row.option.id, row.option.categoryId),
      brand,
      href: `/checkout?produto=${encodeURIComponent(row.option.id)}`
    };
  });

  return (
    <main className="nxPage nxCommercePage">
      <header className="nxHeader nxHeaderV5">
        <a href="/" className="nxLogo" aria-label="NexusGames - página inicial">
          <img src="/assets/nexus-logo" alt="NexusGames" />
          <div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div>
        </a>

        <nav className="nxNav" aria-label="Navegação principal">
          <a className="active" href="#inicio">Início</a>
          <a href="#categorias">Categorias</a>
          <a href="#catalogo">Produtos</a>
          <a href="#como">Como funciona</a>
          <a href={discord} target="_blank" rel="noreferrer">Suporte</a>
        </nav>

        <a href="#catalogo" className="nxSearch" aria-label="Buscar produtos">
          <span aria-hidden="true">⌕</span><b>Buscar jogos, recargas e gift cards</b>
        </a>
        <HeaderActions discord={discord} />
      </header>

      <section className="nxHero nxHeroV5" id="inicio">
        <div className="nxHeroBackdrop" aria-hidden="true">
          <img src={NEXUS_HERO_BACKGROUND} alt="" />
          <div className="nxHeroBackdropShade" />
        </div>

        <div className="nxHeroCopy nxHeroCopyV5">
          <span className="nxEyebrow"><i /> ENTREGA DIGITAL • PIX • SUPORTE</span>
          <h1>JOGUE MAIS.<br/><em>PAGUE MENOS.</em></h1>
          <p>Recargas, gift cards e créditos digitais com disponibilidade verificada, pagamento por Pix e acompanhamento do pedido.</p>

          <div className="nxHeroBtns">
            <a className="nxPrimary" href="#catalogo">Explorar produtos <b>→</b></a>
            <a className="nxSecondary nxDiscordHeroButton" href={discord} target="_blank" rel="noreferrer">
              <span className="nxDiscordHeroIcon" aria-hidden="true">◉</span> Entrar no Discord
            </a>
          </div>

          <div className="nxHeroProof" aria-label="Diferenciais da NexusGames">
            <div><strong>Preço atualizado</strong><small>catálogo sincronizado</small></div>
            <div><strong>Estoque validado</strong><small>antes do pagamento</small></div>
            <div><strong>Entrega monitorada</strong><small>status do pedido</small></div>
          </div>
        </div>
      </section>

      <section className="nxTrustStrip" aria-label="Benefícios">
        <div className="nxTrustCard"><span>⚡</span><div><b>Entrega digital</b><small>Fluxo automatizado quando disponível</small></div></div>
        <div className="nxTrustCard"><span>◆</span><div><b>Pix via Mercado Pago</b><small>Checkout protegido e simples</small></div></div>
        <div className="nxTrustCard"><span>✓</span><div><b>Região verificada</b><small>Reduz risco de código incompatível</small></div></div>
        <div className="nxTrustCard"><span>◉</span><div><b>Suporte no Discord</b><small>Canal direto para acompanhar pedidos</small></div></div>
      </section>

      <section className="nxCollectionFeature" aria-label="Coleção de produtos digitais NexusGames">
        <img src="/products/collection.webp" alt="Seleção de produtos digitais e acessórios gamer da NexusGames" />
        <div className="nxCollectionShade" />
        <div className="nxCollectionCopy">
          <span>CATÁLOGO SELECIONADO</span>
          <h2>Créditos e jogos para você entrar na partida.</h2>
          <p>Cada oferta exibida passa por validação de preço, estoque e região antes do pagamento.</p>
          <a href="#catalogo">Ver ofertas disponíveis <b>→</b></a>
        </div>
      </section>

      <StoreExplorer items={items} categories={categories} />

      <section className="nxHow" id="como">
        <div className="nxSectionLead">
          <span>COMPRA SEM COMPLICAÇÃO</span>
          <h2>Do catálogo à entrega em poucos passos.</h2>
          <p>O fluxo foi desenhado para reduzir atrito e deixar claro o que acontece em cada etapa.</p>
        </div>
        <div className="nxHowGrid">
          <article className="nxHowCard"><b>01</b><h3>Escolha o produto</h3><p>Use a busca ou filtre por plataforma para encontrar a opção ideal.</p></article>
          <article className="nxHowCard"><b>02</b><h3>Revise os dados</h3><p>Confirmamos preço, região e disponibilidade antes de iniciar o pagamento.</p></article>
          <article className="nxHowCard"><b>03</b><h3>Pague com Pix</h3><p>O pagamento é processado pelo Mercado Pago em um checkout protegido.</p></article>
          <article className="nxHowCard"><b>04</b><h3>Acompanhe a entrega</h3><p>Você recebe o status do pedido e, quando aplicável, o código digital.</p></article>
        </div>
      </section>

      <section className="nxSecurityPanel">
        <div className="nxSecurityCopy">
          <span>CONFIANÇA EM PRIMEIRO LUGAR</span>
          <h2>Uma loja feita para parecer simples porque a parte difícil acontece por trás.</h2>
          <p>Validação de estoque, região, preço e status de pedido trabalham nos bastidores para que a experiência fique direta para quem compra.</p>
          <div className="nxSecurityBullets">
            <b>✓ Disponibilidade conferida</b>
            <b>✓ Checkout protegido</b>
            <b>✓ Status atualizado</b>
          </div>
        </div>
        <div className="nxSecurityVisual" aria-hidden="true">
          <div className="nxSecurityOrb"><img src="/assets/nexus-logo" alt="" /></div>
          <div className="nxSecurityMini one"><small>CATÁLOGO</small><strong>Online</strong></div>
          <div className="nxSecurityMini two"><small>PAGAMENTO</small><strong>Pix</strong></div>
          <div className="nxSecurityMini three"><small>SUPORTE</small><strong>Discord</strong></div>
        </div>
      </section>

      <section className="nxDiscordBanner nxDiscordBannerV5">
        <div className="nxDiscordCopy">
          <span>COMUNIDADE NEXUSGAMES</span>
          <h2>PRECISA DE AJUDA?<br/>FALA COM A GENTE.</h2>
          <p>Entre no Discord para suporte, novidades, promoções e acompanhamento.</p>
          <a href={discord} target="_blank" rel="noreferrer">Entrar no Discord →</a>
        </div>
        <div className="nxDiscordBackdrop" aria-hidden="true">
          <img src={NEXUS_HERO_BACKGROUND} alt="" />
        </div>
      </section>

      <footer className="nxFooter nxFooterV5">
        <div className="nxFooterBrand">
          <a href="/" className="nxLogo"><img src="/assets/nexus-logo" alt="NexusGames"/><div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div></a>
          <p>Recargas, gift cards e produtos digitais em uma experiência simples, rápida e segura.</p>
        </div>
        <div><b>Navegação</b><a href="#inicio">Início</a><a href="#categorias">Categorias</a><a href="#catalogo">Produtos</a><a href="#como">Como funciona</a></div>
        <div><b>Atendimento</b><a href={discord} target="_blank" rel="noreferrer">Discord</a><a href="/login">Minha conta</a><a href="#catalogo">Buscar produto</a></div>
        <div className="nxPayments"><b>Pagamento</b><strong>Mercado Pago</strong><p>Pix • ambiente protegido</p><small>Os produtos disponíveis variam conforme estoque e região.</small></div>
      </footer>
      <div className="nxCopyright"><span>© 2026 NexusGames. Todos os direitos reservados.</span><span>Play More. NexusGames.</span></div>
    </main>
  );
}
