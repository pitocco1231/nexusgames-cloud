import { notFound } from "next/navigation";
import HeaderActions from "../../HeaderActions";
import { products } from "../../../lib/catalog";
import { getLiveOptions } from "../../../lib/liveStore";
import { storeImage, storeLabel } from "../../../lib/storeMedia";
import { productImage } from "../../../lib/productMedia";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = products.find((product) => product.id === id);
  if (!category) notFound();

  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/RDvDTVFwm";
  const live = await getLiveOptions().catch(() => []);
  const rows = live.filter((row) => row.option.categoryId === id);
  const image = storeImage(id);
  const brand = id === "mobile-legends"
    ? { name: "MOBILE LEGENDS", mark: "ML", tone: "ml" }
    : id === "minecraft"
      ? { name: "MINECRAFT", mark: "▣", tone: "mc" }
      : id === "xbox"
        ? { name: "XBOX", mark: "X", tone: "xb" }
        : id === "playstation"
          ? { name: "PLAYSTATION", mark: "PS", tone: "ps" }
          : { name: category.name.replace("🔥 ", ""), mark: "N", tone: "nx" };

  return (
    <main className="nxPage categoryPageV5">
      <header className="nxHeader nxHeaderV5">
        <a href="/" className="nxLogo" aria-label="Voltar para NexusGames">
          <img src="/assets/nexus-logo" alt="NexusGames" />
          <div><strong>NEXUS<span>GAMES</span></strong><small>PLAY MORE</small></div>
        </a>
        <nav className="nxNav" aria-label="Navegação">
          <a href="/">Início</a>
          <a className="active" href="#produtos">Produtos</a>
          <a href={discord} target="_blank" rel="noreferrer">Suporte</a>
        </nav>
        <HeaderActions discord={discord} />
      </header>

      <div className="categoryBreadcrumb"><a href="/">NexusGames</a><span>›</span><b>{category.name.replace("🔥 ", "")}</b></div>

      <section className="categoryMarketHero categoryHeroV5">
        <div className="categoryHeroMedia" aria-hidden="true">
          <img src={image} alt="" />
          <div />
        </div>
        <div className="categoryHeroCopy">
          <span>CATÁLOGO • {storeLabel(id).toUpperCase()}</span>
          <h1>{category.name.replace("🔥 ", "")}</h1>
          <p>{category.description}</p>
          <div className="categoryHeroFacts">
            <b>✓ Estoque validado</b>
            <b>✓ Preço atualizado</b>
            <b>✓ Pagamento por Pix</b>
          </div>
        </div>
      </section>

      <section className="categoryProductsV5" id="produtos">
        <div className="marketSectionHead">
          <div><span>OFERTAS DISPONÍVEIS</span><h2>Escolha sua opção</h2></div>
          <p>{rows.length ? `${rows.length} ${rows.length === 1 ? "produto disponível" : "produtos disponíveis"} agora.` : "Nenhuma oferta disponível no momento."}</p>
        </div>

        {rows.length ? (
          <div className="categoryProductGridV5">
            {rows.map((row, index) => (
              <a className="categoryProductCard categoryProductCardV5" href={`/checkout?produto=${encodeURIComponent(row.option.id)}`} key={row.option.id}>
                <div className="categoryProductMedia">
                  <img src={productImage(row.option.id, row.option.categoryId)} alt={`${category.name} - ${row.option.label}`} loading="lazy" />
                  <div className="categoryProductMediaShade" />
                  <span className="categoryProductIndex">0{index + 1}</span>
                  <div className={`marketBrand marketBrand-${brand.tone}`}><b>{brand.mark}</b><span>{brand.name}</span></div>
                  <div className="categoryProductVisualCopy"><small>{category.name.replace("🔥 ", "")}</small><strong>{row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim()}</strong></div>
                </div>
                <div className="categoryProductBodyV5">
                  <span className="categoryProductType">{row.option.fulfillmentType === "direct_topup" ? "ENTREGA DIRETA" : "CÓDIGO DIGITAL"}</span>
                  <h3>{row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim()}</h3>
                  <p>{row.option.description}</p>
                  <div className="categoryProductBottomV5">
                    <div><small>Preço atual</small><strong>R$ {row.salePriceBrl.toFixed(2).replace(".", ",")}</strong></div>
                    <b>Comprar →</b>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="categoryEmptyV5">
            <span>◌</span><h2>Sem estoque agora</h2><p>Estamos aguardando uma oferta segura e compatível com a região.</p><a href="/">Ver outras categorias</a>
          </div>
        )}
      </section>

      <section className="categoryAssuranceV5">
        <div><b>01</b><strong>Escolha</strong><small>Selecione a opção certa para sua conta.</small></div>
        <div><b>02</b><strong>Confirme</strong><small>Revise dados e região antes de pagar.</small></div>
        <div><b>03</b><strong>Pague</strong><small>Finalize por Pix via Mercado Pago.</small></div>
        <div><b>04</b><strong>Receba</strong><small>Acompanhe a entrega do seu pedido.</small></div>
      </section>
    </main>
  );
}
