import { notFound } from "next/navigation";
import Script from "next/script";
import { getLiveOption } from "../../lib/liveStore";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ produto?: string }> }) {
  const { produto } = await searchParams;
  if (!produto) notFound();
  const live = await getLiveOption(produto, true).catch(() => null);
  if (!live) notFound();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const safeProduct = {
    id: live.option.id,
    categoryId: live.option.categoryId,
    name: live.option.name,
    label: live.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim(),
    emoji: live.option.emoji,
    price: live.salePriceBrl,
    directTopup: live.option.fulfillmentType === "direct_topup"
  };

  return (
    <main className="checkoutPage">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /> : null}
      <a className="siteBrand checkoutBrand" href="/"><span className="brandMark">N</span><span>NEXUS<span>GAMES</span></span></a>
      <CheckoutClient product={safeProduct} siteKey={siteKey} />
    </main>
  );
}
