import { notFound } from "next/navigation";
import { products } from "../../../lib/catalog";
import { getLiveOptionsForCategory } from "../../../lib/liveStore";

const images: Record<string, string> = {
  "mobile-legends": "https://sultra.disway.id/upload/250f57b3b1ebcb0945512ae3c2ac7ca0.jpg",
  playstation: "https://i5.walmartimages.com/seo/PlayStation-Store-50-Gift-Card_54093b0e-462f-4e5a-a74d-3067938b1628.f5ab47601f117e726a441e4edffbc312.jpeg?odnBg=FFFFFF&odnHeight=576&odnWidth=576",
  xbox: "https://cdkeyprices.com/images/cards/xbox-game-pass/xbox-game-pass-logo-2.jpg",
  minecraft: "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg",
  roblox: "https://partners.pay-card.shop/storage/2465/01K7D0JRVR34SQ5HN4M6YZR6AH.webp",
  valorant: "https://space-waves.co/data/image/game/valorant/valorant.png",
  steam: "https://images.prom.ua/5831357315_w640_h640_podarochnaya-karta-steam.jpg"
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
                    <a href={`/checkout?produto=${encodeURIComponent(row.option.id)}`}>Comprar agora →</a>
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
