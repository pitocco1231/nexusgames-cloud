import { notFound } from "next/navigation";
import { products } from "../../../lib/catalog";
import { getLiveOptionsForCategory } from "../../../lib/liveStore";

const images: Record<string, string> = {
  "mobile-legends": "/assets/mobile-legends",
  playstation: "/assets/playstation",
  xbox: "/assets/xbox",
  minecraft: "/assets/minecraft",
  roblox: "/assets/roblox",
  valorant: "/assets/valorant",
  steam: "/assets/steam"
};

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = products.find((item) => item.id === id);
  if (!product) notFound();

  const rows = await getLiveOptionsForCategory(id, true).catch(() => []);
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "#";

  return (
    <main className="siteShell">
      <header className="siteNav">
        <a className="siteBrand" href="/"><span className="brandMark">N</span><span>NEXUS<span>GAMES</span></span></a>
        <a className="navCta ghost" href="/">← Voltar</a>
      </header>

      <section className="categoryHero">
        <img src={images[id]} alt={product.name} />
        <div className="categoryHeroShade" />
        <div className="categoryHeroContent">
          <span className="heroBadge"><i /> CATÁLOGO ATUALIZADO</span>
          <h1>{product.name.replace("🔥 ", "")}</h1>
          <p>{product.description}</p>
        </div>
      </section>

      <section className="productSection">
        <div className="sectionHeading compact">
          <span>PRODUTOS DISPONÍVEIS</span>
          <h2>Escolha sua opção.</h2>
          <p>Preço e disponibilidade são reconfirmados antes do pagamento.</p>
        </div>

        {rows.length ? (
          <div className="productGrid">
            {rows.map((row, index) => (
              <article className="productCard" key={row.option.id}>
                {index === 0 ? <span className="bestTag">MELHOR PREÇO</span> : null}
                <span className="productEmoji">{row.option.emoji}</span>
                <h3>{row.option.name.replace(`${product.name.replace("🔥 ", "")} — `, "")}</h3>
                <p>{row.option.description}</p>
                <div className="productBottom">
                  <div><small>Preço</small><strong>R$ {row.salePriceBrl.toFixed(2).replace(".", ",")}</strong></div>
                  <a className="gameButton" href={`/checkout?produto=${encodeURIComponent(row.option.id)}`}>Comprar <b>→</b></a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <span>🕒</span>
            <h3>Sem oferta segura agora</h3>
            <p>Essa categoria volta automaticamente quando houver estoque e região compatível.</p>
            <a className="secondaryButton" href={discordInvite}>Falar com o suporte</a>
          </div>
        )}
      </section>
    </main>
  );
}
