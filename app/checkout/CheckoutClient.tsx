"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  label: string;
  emoji: string;
  image: string;
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

function money(value: number) {
  return "R$ " + value.toFixed(2).replace(".", ",");
}

function paymentStatus(status: string) {
  if (status === "DELIVERED") return "Pedido entregue";
  if (status === "PAID" || status === "PURCHASING") return "Pagamento aprovado • preparando entrega";
  return "Aguardando pagamento";
}

export default function CheckoutClient({ product, siteKey }: { product: Product; siteKey: string }) {
  const [email, setEmail] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [deliveredKey, setDeliveredKey] = useState("");
  const [copied, setCopied] = useState<"pix" | "key" | null>(null);
  const [remaining, setRemaining] = useState("");
  const requestId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!result?.expiresAt) return;
    const update = () => {
      const distance = new Date(result.expiresAt as string).getTime() - Date.now();
      if (distance <= 0) {
        setRemaining("Expirado");
        return;
      }
      const minutes = Math.floor(distance / 60000);
      const seconds = Math.floor((distance % 60000) / 1000);
      setRemaining(minutes + ":" + String(seconds).padStart(2, "0"));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [result?.expiresAt]);

  useEffect(() => {
    if (!result?.orderNumber || !result.orderToken) return;
    const check = async () => {
      const response = await fetch("/api/store/order?order=" + encodeURIComponent(result.orderNumber as string) + "&token=" + encodeURIComponent(result.orderToken as string), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setOrderStatus(String(data.status || ""));
      if (data.deliveredKey) setDeliveredKey(String(data.deliveredKey));
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => window.clearInterval(timer);
  }, [result?.orderNumber, result?.orderToken]);

  async function copy(value: string, type: "pix" | "key") {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

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
          email: email.trim().toLowerCase(),
          playerId: playerId.trim(),
          zoneId: zoneId.trim(),
          requestId,
          turnstile,
          company: ""
        })
      });
      const data = await response.json();
      setResult(data);
      if (data.ok) setOrderStatus("AWAITING_PAYMENT");
    } catch {
      setResult({ ok: false, message: "Não foi possível iniciar o checkout. Confira sua conexão e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok && result.orderNumber) {
    const amount = Number(result.amount || product.price);
    return (
      <section className="checkoutCard checkoutCardV5 nxPaymentScreen" aria-live="polite">
        <div className="checkoutProgress">
          <span className="done">1. Produto</span><span className="done">2. Dados</span><span className="active">3. Pagamento</span><span>4. Entrega</span>
        </div>

        <div className="nxPaymentHeader">
          <span className="checkoutEyebrow">PEDIDO {result.orderNumber}</span>
          <h1>Pague com Pix</h1>
          <p>Escaneie o QR Code ou copie o código abaixo. A confirmação acontece automaticamente.</p>
        </div>

        <div className="nxPaymentLayout">
          <div className="nxQrPanel">
            {result.qrCodeBase64 ? <img className="pixQr" src={result.qrCodeBase64.startsWith("data:") ? result.qrCodeBase64 : "data:image/png;base64," + result.qrCodeBase64} alt="QR Code para pagamento via Pix" /> : <div className="nxQrPlaceholder">QR Code sendo preparado</div>}
            {remaining ? <span className={"nxPixTimer " + (remaining === "Expirado" ? "expired" : "")}>Tempo para pagar: <strong>{remaining}</strong></span> : null}
          </div>
          <div className="nxPaymentInstructions">
            <div className="nxPayTotal"><small>TOTAL DO PEDIDO</small><strong>{money(amount)}</strong></div>
            <ol><li>Abra o aplicativo do seu banco.</li><li>Escolha pagar com Pix.</li><li>Escaneie o QR Code ou use Copia e Cola.</li></ol>
            <div className="orderLiveStatus"><i className={orderStatus === "DELIVERED" ? "green" : ""} /><span>{paymentStatus(orderStatus)}</span></div>
          </div>
        </div>

        {result.qrCode ? (
          <div className="nxPixCopy">
            <label>PIX COPIA E COLA</label>
            <div className="copyBox"><code>{result.qrCode}</code><button type="button" onClick={() => void copy(result.qrCode || "", "pix")}>{copied === "pix" ? "Copiado ✓" : "Copiar código"}</button></div>
          </div>
        ) : null}

        {deliveredKey ? <div className="deliveredKey"><small>SEU CÓDIGO DIGITAL</small><strong>{deliveredKey}</strong><button type="button" onClick={() => void copy(deliveredKey, "key")}>{copied === "key" ? "Copiado ✓" : "Copiar código"}</button></div> : null}

        <div className="nxPaymentFooter"><span>Pagamento processado pelo Mercado Pago</span><span>Esta página atualiza o pedido automaticamente</span></div>
        <small className="securityNote">Nunca compartilhe seu QR Code, código entregue ou dados bancários.</small>
      </section>
    );
  }

  return (
    <section className="checkoutCard checkoutCardV5">
      <div className="checkoutProgress"><span className="active">1. Produto</span><span>2. Dados</span><span>3. Pagamento</span><span>4. Entrega</span></div>

      <div className="checkoutProduct checkoutProductV5">
        <div className="checkoutProductImage"><img src={product.image} alt={"Imagem de " + product.categoryName + " " + product.label} /></div>
        <div className="checkoutProductCopy"><small>{product.categoryName.toUpperCase()}</small><h1>{product.label}</h1><p>{product.directTopup ? "Recarga direta após a confirmação do pagamento" : "Código digital após a confirmação do pagamento"}</p></div>
        <div className="nxCheckoutPrice"><small>TOTAL</small><strong>{money(product.price)}</strong></div>
      </div>

      <form onSubmit={submit} className="checkoutForm checkoutFormV5">
        <div className="checkoutFormHeading"><span>DADOS PARA ENTREGA</span><h2>Complete as informações do pedido</h2><p>Pedimos apenas o necessário para confirmar e entregar sua compra.</p></div>

        <label>E-mail para recibo e acompanhamento
          <input type="email" required maxLength={180} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" />
          <small>O status do pedido será vinculado a este e-mail.</small>
        </label>

        {product.directTopup ? (
          <div className="twoFields">
            <label>Player ID
              <input inputMode="numeric" pattern="[0-9]{3,20}" required value={playerId} onChange={(event) => setPlayerId(event.target.value.replace(/\D/g, ""))} placeholder="123456789" />
              <small>Confira dentro do seu perfil no jogo.</small>
            </label>
            <label>Zone ID
              <input inputMode="numeric" pattern="[0-9]{3,20}" required value={zoneId} onChange={(event) => setZoneId(event.target.value.replace(/\D/g, ""))} placeholder="1234" />
              <small>Normalmente aparece ao lado do Player ID.</small>
            </label>
          </div>
        ) : null}

        <fieldset className="nxPaymentMethods">
          <legend>FORMA DE PAGAMENTO</legend>
          <label className="nxPaymentMethod selected">
            <input type="radio" name="paymentMethod" value="pix" defaultChecked />
            <span className="nxPixMark">PIX</span>
            <span><strong>Pix</strong><small>Aprovação rápida pelo Mercado Pago</small></span>
            <b>Selecionado</b>
          </label>
          <p>Outras formas aparecerão quando estiverem disponíveis e configuradas com segurança.</p>
        </fieldset>

        <input className="honeypot" tabIndex={-1} autoComplete="off" name="company" aria-hidden="true" />
        {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" /> : null}

        <div className="checkoutAssurance"><span>Dados protegidos</span><span>Pix via Mercado Pago</span><span>Produto validado</span></div>
        <div className="nxCheckoutTotal"><span><small>Você pagará</small><strong>{money(product.price)}</strong></span><small>Nenhuma taxa adicional será incluída nesta etapa.</small></div>

        <button className="checkoutButton" type="submit" disabled={loading}>
          {loading ? <><i className="checkoutSpinner" /> Validando disponibilidade...</> : <>Gerar pagamento Pix <b>{money(product.price)}</b></>}
        </button>
        <p className="nxTerms">Ao continuar, você confirma que revisou o produto, a região e os dados informados.</p>
        {result?.message ? <div role="status" className={result.code === "PRELAUNCH" ? "checkoutNotice" : "checkoutError"}>{result.message}</div> : null}
      </form>
    </section>
  );
}
