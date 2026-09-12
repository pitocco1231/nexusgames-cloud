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
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";

  return (
    <main className="marketShell">
      <header className="marketNav">
        <a href="/" className="marketLogo">
          <img src="/assets/nexus-icon" alt="NexusGames" />
          <div><strong>NEXUS</strong><span>GAMES</span></div>
        </a>
        <a className="categoryBack" href="/">← Voltar para a loja</a>
      </header>

      <section className="categoryMarketHero">
        <img src={images[id] || "/assets/nexus-icon"} alt={product.name} />
        <div className="categoryMarketShade" />
        <div className="categoryMarketCopy">
          <span className="marketEyebrow">{rows.length ? "DISPONÍVEL AGORA" : "CATÁLOGO NEXUS"}</span>
          <h1>{product.name.replace("🔥 ", "")}</h1>
          <p>{product.description}</p>
          <div className="categoryMarketBadges">
            <b>⚡ Produto digital</b>
            <b>🔒 Checkout protegido</b>
            <b>💠 Pix Mercado Pago</b>
          </div>
        </div>
      </section>

      <section className="categoryProducts">
        <div className="marketSectionHead">
          <div><span>ESCOLHA SUA OPÇÃO</span><h2>Produtos</h2></div>
          <p>Os valores abaixo são atualizados pelo catálogo. Antes do pagamento, a disponibilidade é verificada novamente.</p>
        </div>

        {rows.length ? (
          <div className="categoryProductGrid">
            {rows.map((row, index) => (
              <article className="categoryProductCard" key={row.option.id}>
                <div className="categoryProductImage">
                  <img src={images[id] || "/assets/nexus-icon"} alt={row.option.name} />
                  <div className="categoryProductImageShade" />
                  {index === 0 ? <span>⭐ MELHOR PREÇO</span> : <span>⚡ DIGITAL</span>}
                </div>
                <div className="categoryProductBody">
                  <small>{product.name.replace("🔥 ", "")}</small>
                  <h3>{row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim()}</h3>
                  <p>{row.option.description}</p>
                  <div className="categoryProductMeta">
                    <span>🌎 Região validada</span>
                    <span>🔐 Entrega protegida</span>
                  </div>
                  <div className="categoryProductBottom">
                    <div><small>Preço</small><strong>R$ {row.salePriceBrl.toFixed(2).replace(".", ",")}</strong></div>
                    <a href={\`/checkout?produto=\${encodeURIComponent(row.option.id)}\`}>Comprar agora →</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="marketEmpty categoryEmpty">
            <img src={images[id] || "/assets/nexus-icon"} alt="" />
            <div><h3>Essa categoria está em preparação.</h3><p>Só liberamos produtos quando região, estoque e fornecedor estão validados.</p><a href={discordInvite}>Falar com o suporte →</a></div>
          </div>
        )}
      </section>
    </main>
  );
}
