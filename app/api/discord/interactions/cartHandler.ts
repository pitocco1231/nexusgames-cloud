import nacl from "tweetnacl";
import { after } from "next/server";
import { POST as legacyHandler } from "./handler";
import {
  getProduct,
  getProductOption,
  resolveCategoryId,
  type ProductOption
} from "../../../../lib/catalog";
import { getBestSupplierOffer, updateOrderStatus } from "../../../../lib/checkoutStore";
import {
  bindCartOrder,
  closeCart,
  createCartChannel,
  getCartContext,
  notifyCartStatus,
  upsertCartPanel
} from "../../../../lib/cart";
import {
  buttonLabel,
  displayLabel,
  getLiveCategories,
  getLiveOption,
  getLiveOptionsForCategory
} from "../../../../lib/liveStore";
import {
  createPixOrder,
  getMercadoPagoOrder,
  getPixDetails,
  isMercadoPagoProductionConfigured,
  isMercadoPagoWebhookConfigured,
  type MercadoPagoOrder
} from "../../../../lib/mercadopago";
import { quoteAndAttachOrder } from "../../../../lib/pricing";
import { grantCustomerRole } from "../../../../lib/roles";
import { validateShop2TopupPlayer } from "../../../../lib/shop2topup";
import {
  attachMercadoPagoSandboxOrder,
  createDiscordOrder,
  findDiscordOrderByNumber,
  getMercadoPagoPaymentForOrder,
  syncMercadoPagoOrder
} from "../../../../lib/supabase";

const PUBLIC_KEY_ENV = "DISCORD_PUBLIC_KEY";
const APPLICATION_ID = "1547332142776975400";
const DISCORD_API = "https://discord.com/api/v10";

function hexToBytes(hex: string) {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

function verifyDiscordRequest(body: string, signature: string, timestamp: string) {
  const publicKey = process.env[PUBLIC_KEY_ENV];
  if (!publicKey) return false;
  return nacl.sign.detached.verify(
    Uint8Array.from(Buffer.from(timestamp + body)),
    hexToBytes(signature),
    hexToBytes(publicKey)
  );
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function realPaymentsReady() {
  return (
    process.env.NEXUS_REAL_PAYMENTS_ENABLED === "true" &&
    process.env.NEXUS_REAL_FULFILLMENT_ENABLED === "true" &&
    isMercadoPagoProductionConfigured() &&
    isMercadoPagoWebhookConfigured("production")
  );
}

function requestFromBody(original: Request, body: string) {
  return new Request(original.url, {
    method: "POST",
    headers: new Headers(original.headers),
    body
  });
}

async function editDeferredInteraction(interactionToken: string, data: Record<string, unknown>) {
  const response = await fetch(`${DISCORD_API}/webhooks/${APPLICATION_ID}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook ${response.status}: ${text.slice(0, 300)}`);
  }
}

function modalField(interaction: Record<string, any>, fieldId: string) {
  const rows = Array.isArray(interaction.data?.components) ? interaction.data.components : [];
  for (const row of rows) {
    const components = Array.isArray(row?.components) ? row.components : [];
    for (const component of components) {
      if (component?.custom_id === fieldId) return String(component.value || "").trim();
    }
  }
  return "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

function validGameId(value: string) {
  return /^\d{3,20}$/.test(value);
}

function chunkRows<T>(items: T[], size = 5) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

async function liveCatalogPayload() {
  const categories = await getLiveCategories();
  if (!categories.length) {
    return {
      type: 4,
      data: { flags: 64, content: "⚠️ O fornecedor está sem ofertas seguras disponíveis no momento." }
    };
  }
  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [{
        color: 0x7c3aed,
        title: "🛒 Loja NexusGames",
        description: [
          "Escolha uma categoria abaixo.",
          "",
          "✅ só aparecem produtos com oferta ativa no fornecedor",
          "💰 usamos a oferta de menor custo sincronizada",
          "🔐 ao comprar, um carrinho privado é criado só para você",
          "⚡ produto, validação, Pix e entrega ficam no mesmo checkout"
        ].join("\n")
      }],
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: "product_select",
          placeholder: "Escolha uma categoria",
          min_values: 1,
          max_values: 1,
          options: categories.slice(0, 25).map((category) => ({
            label: category.name.slice(0, 100),
            value: category.id,
            description: category.description.slice(0, 90),
            emoji: { name: category.emoji }
          }))
        }]
      }]
    }
  };
}

async function liveCategoryData(categoryId: string) {
  const category = getProduct(categoryId);
  const rows = await getLiveOptionsForCategory(categoryId);
  if (!category || !rows.length) {
    return {
      flags: 64,
      content: "❌ Nenhuma oferta segura e em estoque para esta categoria agora.",
      embeds: [],
      components: []
    };
  }
  return {
    flags: 64,
    embeds: [{
      color: 0x7c3aed,
      title: `${category.emoji} ${category.name}`,
      description: [
        category.description,
        "",
        "### Produtos disponíveis agora",
        ...rows.map((row) => `• **${displayLabel(row)}**`),
        "",
        "🛒 Clique em comprar e abriremos um checkout privado para você.",
        "⚡ Preço, região e estoque são reconfirmados antes do pagamento."
      ].join("\n")
    }],
    components: chunkRows(rows.slice(0, 25)).map((row) => ({
      type: 1,
      components: row.map((item) => ({
        type: 2,
        style: 3,
        custom_id: `buy:${item.option.id}`,
        label: buttonLabel(item),
        emoji: { name: item.option.emoji }
      }))
    }))
  };
}

function cartWaitingPayload(option: ProductOption, price: number) {
  return {
    embeds: [{
      color: 0x7c3aed,
      title: "🛒 Carrinho NexusGames",
      description: [
        "### Resumo da compra",
        `${option.emoji} **${option.name}**`,
        `Total: **${money(price)}**`,
        "",
        "**Próxima etapa:** validar a conta que receberá a recarga.",
        "Clique em **Informar dados** e envie apenas Player ID + Zone ID.",
        "",
        "🔐 Nunca pedimos sua senha do jogo."
      ].join("\n")
    }],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, custom_id: `cart:topup:${option.id}`, label: "Informar dados", emoji: { name: "🎮" } },
          { type: 2, style: 4, custom_id: "cart:cancel", label: "Cancelar carrinho", emoji: { name: "✖️" } }
        ]
      }
    ]
  };
}

function checkoutPayload(params: {
  option: ProductOption;
  orderNumber: string;
  salePrice: number;
  playerName?: string;
  playerId?: string;
  zoneId?: string;
}) {
  return {
    embeds: [{
      color: 0x57f287,
      title: "✅ Checkout confirmado",
      description: [
        "### Revise antes de pagar",
        `${params.option.emoji} **${params.option.name}**`,
        params.playerName ? `Conta validada: **${params.playerName}**` : null,
        params.playerId ? `Player ID: **${params.playerId}**` : null,
        params.zoneId ? `Zone ID: **${params.zoneId}**` : null,
        `Pedido: **${params.orderNumber}**`,
        `Total: **${money(params.salePrice)}**`,
        "",
        "✅ preço e estoque reconfirmados",
        "✅ região compatível validada",
        params.option.fulfillmentType === "direct_topup"
          ? "💎 a recarga será enviada para a conta acima após o pagamento"
          : "🔑 o código será entregue de forma privada após o pagamento",
        "",
        realPaymentsReady()
          ? "Se os dados estiverem corretos, clique em **Finalizar no Pix**."
          : "⚠️ Checkout em pré-lançamento: o Pix real será liberado junto com a entrega automática."
      ].filter(Boolean).join("\n")
    }],
    components: [{
      type: 1,
      components: [
        ...(realPaymentsReady() ? [{ type: 2, style: 3, custom_id: `cart:pix:${params.orderNumber}`, label: `Finalizar no Pix • ${money(params.salePrice)}`, emoji: { name: "💠" } }] : []),
        { type: 2, style: 4, custom_id: "cart:cancel", label: "Cancelar pedido", emoji: { name: "✖️" } }
      ]
    }]
  };
}

function topupModal(option: ProductOption) {
  return {
    type: 9,
    data: {
      custom_id: `cart:topup-modal:${option.id}`,
      title: "Validar conta Mobile Legends",
      components: [
        { type: 1, components: [{ type: 4, custom_id: "player_id", label: "Player ID", style: 1, min_length: 3, max_length: 20, required: true, placeholder: "Ex.: 123456789" }] },
        { type: 1, components: [{ type: 4, custom_id: "zone_id", label: "Zone ID", style: 1, min_length: 3, max_length: 20, required: true, placeholder: "Ex.: 1234" }] }
      ]
    }
  };
}

function pixEmailModal(orderNumber: string) {
  return {
    type: 9,
    data: {
      custom_id: `cart:pix-modal:${orderNumber}`,
      title: "Finalizar pagamento Pix",
      components: [{
        type: 1,
        components: [{ type: 4, custom_id: "payer_email", label: "E-mail para o recibo", style: 1, min_length: 5, max_length: 180, required: true, placeholder: "voce@email.com" }]
      }]
    }
  };
}

function pixStatusText(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  const status = order.status || payment?.status || "unknown";
  const detail = order.status_detail || payment?.status_detail || "";
  if (status === "processed" && detail === "accredited") return "✅ Pagamento aprovado";
  if (status === "action_required") return "⏳ Aguardando pagamento";
  if (status === "processing") return "🔄 Processando";
  if (status === "expired") return "⌛ Expirado";
  if (status === "canceled") return "⚫ Cancelado";
  if (status === "failed") return "❌ Falhou";
  return `ℹ️ ${status}${detail ? ` / ${detail}` : ""}`;
}

function pixPanel(orderNumber: string, providerOrder: MercadoPagoOrder) {
  const pix = getPixDetails(providerOrder);
  const amount = Number(providerOrder.total_amount || providerOrder.transactions?.payments?.[0]?.amount || 0);
  const actions: Array<Record<string, unknown>> = [];
  if (pix.ticketUrl) actions.push({ type: 2, style: 5, label: "Abrir Pix", url: pix.ticketUrl, emoji: { name: "💠" } });
  actions.push({ type: 2, style: 1, custom_id: `cart:pix-refresh:${orderNumber}`, label: "Atualizar pagamento", emoji: { name: "🔄" } });
  actions.push({ type: 2, style: 4, custom_id: "cart:cancel", label: "Fechar carrinho", emoji: { name: "🔒" } });
  return {
    embeds: [{
      color: 0x00a650,
      title: "💠 Pix NexusGames",
      description: [
        `Pedido: **${orderNumber}**`,
        amount > 0 ? `Valor: **${money(amount)}**` : null,
        `Status: **${pixStatusText(providerOrder)}**`,
        pix.expiresAt ? `Expira em: **${pix.expiresAt}**` : null,
        pix.qrCode ? `\n**Pix Copia e Cola:**\n\`${pix.qrCode}\`` : null,
        "",
        "📱 Escaneie o QR Code abaixo ou use o copia e cola.",
        "⚡ Assim que o Mercado Pago aprovar, o carrinho avança automaticamente para a entrega."
      ].filter(Boolean).join("\n")
    }],
    components: [{ type: 1, components: actions }]
  };
}

async function assertCartOwner(channelId: string, userId: string) {
  const { context } = await getCartContext(channelId);
  if (!context || context.state !== "open" || context.ownerId !== userId) {
    throw new Error("Este carrinho não pertence a você ou já foi fechado.");
  }
  return context;
}

async function processCreateCart(params: {
  optionId: string;
  userId: string;
  username: string;
  interactionId: string;
  interactionToken: string;
}) {
  try {
    const live = await getLiveOption(params.optionId, true);
    if (!live) throw new Error("A oferta ficou indisponível no fornecedor. Tente outro produto.");
    const option = live.option;
    const cart = await createCartChannel({ userId: params.userId, username: params.username, optionId: option.id });

    if (cart.existingOrder) {
      await editDeferredInteraction(params.interactionToken, {
        content: `🛒 Você já possui um pedido aberto. Finalize ou feche o carrinho atual antes de iniciar outro: <#${cart.channelId}>`,
        embeds: [],
        components: []
      });
      return;
    }

    if (option.fulfillmentType === "direct_topup") {
      await upsertCartPanel(cart.channelId, "main", cartWaitingPayload(option, live.salePriceBrl));
    } else {
      const result = await createDiscordOrder({
        discordUserId: params.userId,
        discordUsername: params.username,
        productId: option.id,
        interactionId: params.interactionId
      });
      if (!result.order.id) throw new Error("Pedido sem ID.");
      const quote = await quoteAndAttachOrder(String(result.order.id), option.id);
      await bindCartOrder({ channelId: cart.channelId, ownerId: params.userId, optionId: option.id, orderNumber: result.order.order_number });
      await upsertCartPanel(cart.channelId, "main", checkoutPayload({ option, orderNumber: result.order.order_number, salePrice: quote.salePriceBrl }));
    }

    await editDeferredInteraction(params.interactionToken, {
      content: `🛒 Checkout privado criado: <#${cart.channelId}>`,
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ Não consegui abrir o carrinho. ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

async function processTopup(params: {
  optionId: string;
  playerId: string;
  zoneId: string;
  userId: string;
  username: string;
  channelId: string;
  interactionId: string;
  interactionToken: string;
}) {
  try {
    await assertCartOwner(params.channelId, params.userId);
    if (!validGameId(params.playerId) || !validGameId(params.zoneId)) throw new Error("Player ID ou Zone ID inválido.");
    const live = await getLiveOption(params.optionId, true);
    const option = live?.option;
    if (!option || option.fulfillmentType !== "direct_topup") throw new Error("Oferta indisponível.");
    const offer = await getBestSupplierOffer(option.id);
    if (!offer?.supplier_sku || offer.region !== "BR") throw new Error("Oferta Brasil indisponível no momento.");

    const validation = await validateShop2TopupPlayer({
      subCategoryId: Number(offer.supplier_sku),
      requirements: { player_id: params.playerId, zone_id: params.zoneId }
    }) as Record<string, any>;
    if (validation.success === false) throw new Error("A conta não foi validada pelo fornecedor.");
    const player = validation.player || validation.data?.player || validation.data || {};
    const playerName = String(player.player_name || player.name || "").trim();

    const result = await createDiscordOrder({
      discordUserId: params.userId,
      discordUsername: params.username,
      productId: option.id,
      interactionId: params.interactionId,
      fulfillmentData: {
        player_id: params.playerId,
        zone_id: params.zoneId,
        player_name: playerName || null,
        validated_at: new Date().toISOString()
      }
    });
    if (!result.order.id) throw new Error("Não foi possível criar o pedido.");
    const quote = await quoteAndAttachOrder(String(result.order.id), option.id);
    await bindCartOrder({ channelId: params.channelId, ownerId: params.userId, optionId: option.id, orderNumber: result.order.order_number });
    await upsertCartPanel(params.channelId, "main", checkoutPayload({
      option,
      orderNumber: result.order.order_number,
      salePrice: quote.salePriceBrl,
      playerName: playerName || undefined,
      playerId: params.playerId,
      zoneId: params.zoneId
    }));
    await editDeferredInteraction(params.interactionToken, { content: "✅ Conta validada. Revise os dados e finalize a compra pelo carrinho.", embeds: [], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ Não consegui validar essa conta. ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

async function processPix(params: {
  orderNumber: string;
  userId: string;
  channelId: string;
  interactionToken: string;
  payerEmail?: string;
  refresh?: boolean;
}) {
  try {
    const context = await assertCartOwner(params.channelId, params.userId);
    if (context.orderNumber && context.orderNumber !== params.orderNumber) throw new Error("Pedido não corresponde a este carrinho.");
    if (!realPaymentsReady()) throw new Error("Pagamento real ainda não está liberado para este checkout.");
    const localOrder = await findDiscordOrderByNumber(params.userId, params.orderNumber);
    if (!localOrder?.id) throw new Error("Pedido não encontrado.");
    const amount = Number(localOrder.total_price_brl || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Pedido sem preço final válido.");
    const payment = await getMercadoPagoPaymentForOrder(localOrder.id);
    let providerOrder: MercadoPagoOrder;

    if (params.refresh) {
      if (!payment?.provider_payment_id) throw new Error("Este pedido ainda não possui Pix.");
      providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    } else if (payment?.provider_payment_id) {
      providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    } else {
      if (!params.payerEmail || !validEmail(params.payerEmail)) throw new Error("Informe um e-mail válido.");
      providerOrder = await createPixOrder({
        mode: "production",
        localOrderId: localOrder.id,
        orderNumber: localOrder.order_number,
        amountBrl: amount,
        payerEmail: params.payerEmail
      });
      await attachMercadoPagoSandboxOrder({ localOrder, providerOrder });
    }

    const synced = await syncMercadoPagoOrder(providerOrder);
    if (synced?.isPaid && synced.discordUserId) {
      await grantCustomerRole(synced.discordUserId).catch(() => null);
    }
    const pix = getPixDetails(providerOrder);
    await upsertCartPanel(params.channelId, `pix-${params.orderNumber}`, pixPanel(params.orderNumber, providerOrder), pix.qrCodeBase64);
    if (synced?.isPaid) await notifyCartStatus({ orderNumber: params.orderNumber, status: "paid" }).catch(() => null);
    await editDeferredInteraction(params.interactionToken, {
      content: params.refresh ? "🔄 Pagamento atualizado no carrinho." : "💠 Pix gerado. Pague pelo QR Code ou copia e cola dentro do carrinho.",
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ Não foi possível atualizar o Pix. ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

async function processCancel(params: { channelId: string; userId: string; memberPermissions?: string; interactionToken: string }) {
  try {
    const { context } = await getCartContext(params.channelId);
    if (!context) throw new Error("Este canal não é um carrinho.");
    const isAdmin = (BigInt(params.memberPermissions || "0") & 8n) === 8n;
    if (context.orderNumber) {
      const order = await findDiscordOrderByNumber(context.ownerId, context.orderNumber);
      if (order?.id && ["PAID", "PURCHASING"].includes(order.status)) {
        throw new Error("O pagamento já foi aprovado; o pedido não pode ser cancelado pelo carrinho.");
      }
      if (order?.id && !["DELIVERED", "REFUNDED", "CANCELLED"].includes(order.status)) {
        await updateOrderStatus(order.id, { status: "CANCELLED", failure_reason: "Cancelado pelo cliente no carrinho." }).catch(() => null);
      }
    }
    await closeCart(params.channelId, params.userId, isAdmin);
    await editDeferredInteraction(params.interactionToken, { content: "🔒 Carrinho fechado.", embeds: [], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const body = await request.text();
  if (!signature || !timestamp || !verifyDiscordRequest(body, signature, timestamp)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as Record<string, any>;
  if (interaction.type === 1) return json({ type: 1 });
  const actor = interaction.member?.user || interaction.user;
  const customId = String(interaction.data?.custom_id || "");
  const channelId = String(interaction.channel_id || "");

  if (interaction.type === 2 && ["comprar", "loja"].includes(String(interaction.data?.name || ""))) {
    return json(await liveCatalogPayload());
  }

  if (interaction.type === 3 && customId === "product_select") {
    const categoryId = resolveCategoryId(String(interaction.data?.values?.[0] || ""));
    if (!categoryId) return json({ type: 4, data: { flags: 64, content: "Categoria indisponível." } });
    return json({ type: 7, data: await liveCategoryData(categoryId) });
  }

  if (interaction.type === 3 && customId.startsWith("buy:")) {
    const requestedId = customId.slice(4);
    const option = getProductOption(requestedId);
    if (!option) {
      const categoryId = resolveCategoryId(requestedId);
      if (categoryId) return json({ type: 4, data: await liveCategoryData(categoryId) });
      return json({ type: 4, data: { flags: 64, content: "❌ Produto indisponível." } });
    }
    if (!actor?.id || !interaction.id || !interaction.token) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua compra." } });
    after(() => processCreateCart({
      optionId: option.id,
      userId: actor.id,
      username: actor.username || "cliente",
      interactionId: interaction.id,
      interactionToken: interaction.token
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  if (interaction.type === 3 && customId.startsWith("cart:topup:")) {
    const option = getProductOption(customId.slice("cart:topup:".length));
    if (!option) return json({ type: 4, data: { flags: 64, content: "❌ Produto indisponível." } });
    return json(topupModal(option));
  }

  if (interaction.type === 3 && customId.startsWith("cart:pix:") && !customId.startsWith("cart:pix-refresh:")) {
    return json(pixEmailModal(customId.slice("cart:pix:".length)));
  }

  if (interaction.type === 3 && customId.startsWith("cart:pix-refresh:")) {
    if (!actor?.id || !interaction.token || !channelId) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
    after(() => processPix({
      orderNumber: customId.slice("cart:pix-refresh:".length),
      userId: actor.id,
      channelId,
      interactionToken: interaction.token,
      refresh: true
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  if (interaction.type === 3 && customId === "cart:cancel") {
    if (!actor?.id || !interaction.token || !channelId) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
    after(() => processCancel({
      channelId,
      userId: actor.id,
      memberPermissions: interaction.member?.permissions,
      interactionToken: interaction.token
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  if (interaction.type === 5 && customId.startsWith("cart:topup-modal:")) {
    if (!actor?.id || !interaction.id || !interaction.token || !channelId) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
    const playerId = modalField(interaction, "player_id");
    const zoneId = modalField(interaction, "zone_id");
    if (!validGameId(playerId) || !validGameId(zoneId)) return json({ type: 4, data: { flags: 64, content: "❌ Use apenas números no Player ID e Zone ID." } });
    after(() => processTopup({
      optionId: customId.slice("cart:topup-modal:".length),
      playerId,
      zoneId,
      userId: actor.id,
      username: actor.username || "cliente",
      channelId,
      interactionId: interaction.id,
      interactionToken: interaction.token
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  if (interaction.type === 5 && customId.startsWith("cart:pix-modal:")) {
    if (!actor?.id || !interaction.token || !channelId) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
    const email = modalField(interaction, "payer_email");
    if (!validEmail(email)) return json({ type: 4, data: { flags: 64, content: "❌ Informe um e-mail válido." } });
    after(() => processPix({
      orderNumber: customId.slice("cart:pix-modal:".length),
      userId: actor.id,
      channelId,
      interactionToken: interaction.token,
      payerEmail: email
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  return legacyHandler(requestFromBody(request, body));
}
