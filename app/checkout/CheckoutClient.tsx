"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  categoryId: string;
  name: string;
  label: string;
  emoji: string;
  price: number;
  directTopup: boolean;
};

type CheckoutResult = {
  ok?: boolean;
  code?: string;
  message?: string;
  orderNumber?: string;
  orderToken?: string;
  amount?: number;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
};

export default function CheckoutClient({ product, siteKey }: { product: Product; siteKey: string }) {
  const [email, setEmail] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [deliveredKey, setDeliveredKey] = useState("");
  const requestId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!result?.orderNumber || !result.orderToken) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/store/order?order=${encodeURIComponent(result.orderNumber!)}&token=${encodeURIComponent(result.orderToken!)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setOrderStatus(String(data.status || ""));
      if (data.deliveredKey) setDeliveredKey(String(data.deliveredKey));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [result?.orderNumber, result?.orderToken]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setOrderStatus("");
    try {
      const turnstile = siteKey
        ? (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value || ""
        : "";
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          email,
          playerId,
          zoneId,
          requestId,
          turnstile,
          company: ""
        })
      });
      const data = await response.json();
      setResult(data);
      if (data.ok) setOrderStatus("AWAITING_PAYMENT");
    } catch {
      setResult({ ok: false, message: "Não foi possível iniciar o checkout. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok && result.orderNumber) {
    return (
      <section className="checkoutCard successCheckout">
        <div className="checkoutProgress"><span className="done">Produto</span><span className="done">Dados</span><span className="active">Pix</span><span>Entrega</span></div>
        <div className="checkoutSuccessIcon">💠</div>
        <span className="checkoutEyebrow">PEDIDO {result.orderNumber}</span>
        <h1>Seu Pix está pronto.</h1>
        <p>Valor: <strong>R$ {Number(result.amount || product.price).toFixed(2).replace(".", ",")}</strong></p>
        {result.qrCodeBase64 ? <img className="pixQr" src={result.qrCodeBase64.startsWith("data:") ? result.qrCodeBase64 : `data:image/png;base64,${result.qrCodeBase64}`} alt="QR Code Pix" /> : null}
        {result.qrCode ? (
          <div className="copyBox">
            <code>{result.qrCode}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(result.qrCode || "")}>Copiar Pix</button>
          </div>
        ) : null}
        <div className="orderLiveStatus"><i className={orderStatus === "DELIVERED" ? "green" : ""} /><span>{orderStatus === "DELIVERED" ? "Pedido entregue" : orderStatus === "PAID" || orderStatus === "PURCHASING" ? "Pagamento aprovado • preparando entrega" : "Aguardando pagamento"}</span></div>
        {deliveredKey ? <div className="deliveredKey"><small>SEU CÓDIGO</small><strong>{deliveredKey}</strong><button onClick={() => navigator.clipboard.writeText(deliveredKey)}>Copiar código</button></div> : null}
        <small className="securityNote">🔐 Não compartilhe este QR Code nem o código entregue.</small>
      </section>
    );
  }

  return (
    <section className="checkoutCard">
      <div className="checkoutProgress"><span className="active">Produto</span><span>Dados</span><span>Pix</span><span>Entrega</span></div>
      <div className="checkoutProduct">
        <span>{product.emoji}</span>
        <div><small>VOCÊ ESTÁ COMPRANDO</small><h1>{product.label}</h1><p>{product.name}</p></div>
        <strong>R$ {product.price.toFixed(2).replace(".", ",")}</strong>
      </div>

      <form onSubmit={submit} className="checkoutForm">
        <label>E-mail para recibo e acompanhamento
          <input type="email" required maxLength={180} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
        </label>
        {product.directTopup ? (
          <div className="twoFields">
            <label>Player ID
              <input inputMode="numeric" pattern="[0-9]{3,20}" required value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="123456789" />
            </label>
            <label>Zone ID
              <input inputMode="numeric" pattern="[0-9]{3,20}" required value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="1234" />
            </label>
          </div>
        ) : null}
        <input className="honeypot" tabIndex={-1} autoComplete="off" name="company" aria-hidden="true" />
        {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" /> : null}
        <div className="checkoutAssurance"><span>🔐 Seus dados ficam protegidos</span><span>💠 Pix via Mercado Pago</span></div>
        <button className="checkoutButton" type="submit" disabled={loading}>{loading ? "Validando..." : `Continuar para o Pix • R$ ${product.price.toFixed(2).replace(".", ",")}`}</button>
        {result?.message ? <div className={result.code === "PRELAUNCH" ? "checkoutNotice" : "checkoutError"}>{result.message}</div> : null}
      </form>
    </section>
  );
}
