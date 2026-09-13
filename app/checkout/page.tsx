import { notFound } from "next/navigation";
import Script from "next/script";
import { getLiveOption } from "../../lib/liveStore";
import { products } from "../../lib/catalog";
import { productImage } from "../../lib/productMedia";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ produto?: string }> }) {
  const { produto } = await searchParams;
  if (!produto) notFound();
  const live = await getLiveOption(produto, true).catch(() => null);
  if (!live) notFound();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const category = products.find((item) => item.id === live.option.categoryId);
  const safeProduct = {
    id: live.option.id,
    categoryId: live.option.categoryId,
    categoryName: category?.name.replace("🔥 ", "") || "Produto digital",
    name: live.option.name,
    label: live.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim(),
    emoji: live.option.emoji,
    image: productImage(live.option.id, live.option.categoryId),
    price: live.salePriceBrl,
    directTopup: live.option.fulfillmentType === "direct_topup"
  };

  return (
    <main className="checkoutPage checkoutPageV5">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /> : null}
      <header className="checkoutTopbar">
        <a className="nxLogo" href="/" aria-label="NexusGames">
          <img src="/assets/nexus-logo" alt="NexusGames" />
          <div><strong>NEXUS<span>GAMES</span></strong><small>CHECKOUT</small></div>
        </a>
        <div className="checkoutTopbarTrust"><span>🔒 Ambiente protegido</span><a href="/">← Voltar para a loja</a></div>
      </header>
      <div className="checkoutShellV5">
        <aside className="checkoutSideV5">
          <span>CHECKOUT NEXUSGAMES</span>
          <h1>Finalize sua compra com segurança.</h1>
          <p>Revise o produto, informe apenas os dados necessários e gere seu Pix pelo Mercado Pago.</p>
          <div className="checkoutSideSteps"><b><i>1</i> Produto validado</b><b><i>2</i> Dados da entrega</b><b><i>3</i> Pix seguro</b><b><i>4</i> Acompanhamento</b></div>
          <div className="checkoutHelpV5"><strong>Precisa de ajuda?</strong><small>O suporte pelo Discord está disponível para acompanhar seu pedido.</small></div>
        </aside>
        <CheckoutClient product={safeProduct} siteKey={siteKey} />
      </div>
    </main>
  );
}
