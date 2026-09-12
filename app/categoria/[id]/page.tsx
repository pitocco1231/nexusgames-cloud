import { notFound } from "next/navigation";
import { products } from "../../../lib/catalog";
import { getLiveOptionsForCategory } from "../../../lib/liveStore";

const images: Record<string, string> = {
  "mobile-legends": "https://epngame.com/images/games/mlbb-big-1720743035-6690747b26195.png",
  playstation: "https://www.pakdukaan.pk/cdn/shop/files/PlayStation-Store-PSN-Gift-Card-Price-in-Pakistan-2_1370x.jpg?v=1731663639",
  xbox: "https://www.nme.com/wp-content/uploads/2025/05/Xbox-Game-Pass-Key-Art-696x442.jpg",
  minecraft: "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg",
  roblox: "https://store-images.s-microsoft.com/image/apps.58700.68327322396008232.bebf9df1-1c64-4f6c-b0af-31eb22f07ff3.ca76e906-0122-4627-925b-3feb7422154f",
  valorant: "https://wegame.gtimg.com/g.2001715-r.9a324/info/1d8ac7c7cdcf660f503405796c7d0d83.jpg/1000",
  steam: "https://www.allkeyshop.com/blog/wp-content/uploads/store_steam_featured.jpg"
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
        <img src={images[id]} alt={product.name} className="categoryBackdropImage" />
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
