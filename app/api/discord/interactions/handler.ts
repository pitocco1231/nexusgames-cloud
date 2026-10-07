import nacl from "tweetnacl";
import { after } from "next/server";
import {
  getProduct,
  getProductOption,
  getProductOptions,
  products,
  resolveCategoryId,
  type ProductOption
} from "../../../../lib/catalog";
import { getBestSupplierOffer } from "../../../../lib/checkoutStore";
import {
  claimSupportTicket,
  closeSupportTicket,
  createSupportTicket,
  getStoreNavigation,
  releaseSupportTicket,
  setSupportTicketWaiting
} from "../../../../lib/discord";
import { maybeHandlePanelInteraction } from "../../../../lib/panelEditor";
import {
  alternativesForUnavailable,
  comparePayload,
  favoritesPayload,
  finderInputFromCommand,
  finderInputFromModal,
  finderModal,
  handleFinderAction,
  metricsPayload,
  profilePayload,
  providerStatusPayload,
  runFinderSearch,
  watchesPayload
} from "../../../../lib/nexusFinderDiscord";
import {
  getOrderForAdmin,
  notifyFortnitePaidSale,
  postPurchaseTicketSummary,
  publicSaleReceipt,
  revalidateOrderListing,
  setOrderDelivered
} from "../../../../lib/fortniteOrders";
import { patchTicketState } from "../../../../lib/nexusData";
import { recordAndPublishReview } from "../../../../lib/nexusReviews";
import { alertOverdueTickets } from "../../../../lib/nexusTicketMonitor";
import {
  createPixOrder,
  createSandboxPixOrder,
  getMercadoPagoOrder,
  getPixDetails,
  getSandboxOrder,
  isMercadoPagoProductionConfigured,
  isMercadoPagoWebhookConfigured,
  MERCADO_PAGO_SANDBOX_AMOUNT_BRL,
  type MercadoPagoOrder
} from "../../../../lib/mercadopago";
import { quoteAndAttachOrder } from "../../../../lib/pricing";
import {
  ensureMemberRole,
  ensureTicketStaffAccess,
  grantCustomerRole,
  isStaffMember
} from "../../../../lib/roles";
import { validateShop2TopupPlayer } from "../../../../lib/shop2topup";
import {
  attachMercadoPagoSandboxOrder,
  createDiscordOrder,
  findDiscordOrderByNumber,
  getMercadoPagoPaymentForOrder,
  listDiscordOrders,
  syncMercadoPagoOrder,
  type NexusOrder
} from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    isMercadoPagoProductionConfigured() &&
    isMercadoPagoWebhookConfigured("production")
  );
}

function purchaseCatalogPayload() {
  const enabled = products.filter((product) => product.enabled);
  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          color: 0x6d5dfb,
          title: "🛒 Catálogo NexusGames",
          description: [
            "Escolha uma categoria abaixo.",
            "",
            "🔥 **Mobile Legends está em destaque:** recarga direta, sem senha e com validação da conta antes do pagamento.",
            "Preço, região e estoque são confirmados antes de qualquer cobrança real."
          ].join("\n")
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: "product_select",
              placeholder: "Escolha uma categoria",
              min_values: 1,
              max_values: 1,
              options: enabled.map((product) => ({
                label: product.name,
                value: product.id,
                description: product.description.slice(0, 90),
                emoji: { name: product.emoji }
              }))
            }
          ]
        }
      ]
    }
  };
}

function categoryOptionsData(categoryId: string) {
  const category = products.find((item) => item.id === categoryId);
  const options = getProductOptions(categoryId);
  if (!category || !options.length) {
    return {
      flags: 64,
      content: "❌ Esta categoria ainda não possui opções disponíveis.",
      embeds: [],
      components: []
    };
  }

  const directTopup = options.some((option) => option.fulfillmentType === "direct_topup");
  return {
    flags: 64,
    embeds: [
      {
        color: 0x6d5dfb,
        title: `${category.emoji} ${category.name}`,
        description: [
          category.description,
          "",
          "### Escolha uma opção",
          ...options.map((option) => `• **${option.label}**`),
          "",
          directTopup ? "🔐 Não pedimos sua senha. Para recarga direta, usamos apenas Player ID + Zone ID." : null,
          realPaymentsReady()
            ? "⚡ Estoque e preço são validados antes de abrir o Pix."
            : "🧪 Pagamentos reais continuam bloqueados; use o fluxo de teste."
        ].filter(Boolean).join("\n")
      }
    ],
    components: [
      {
        type: 1,
        components: options.slice(0, 5).map((option) => ({
          type: 2,
          style: 3,
          custom_id: `buy:${option.id}`,
          label: option.label.slice(0, 80),
          emoji: { name: option.emoji }
        }))
      }
    ]
  };
}

async function storeNavigationPayload() {
  const navigation = await getStoreNavigation();
  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          color: 0x6d5dfb,
          title: "🎮 Escolha sua categoria",
          description: [
            "A loja é organizada por canais. Clique na categoria que você procura:",
            "",
            ...navigation.map((item) => `${item.emoji} **${item.label}** → ${item.mention}`),
            "",
            "💡 Se preferir, use `/comprar` para abrir o catálogo rápido."
          ].join("\n")
        }
      ]
    }
  };
}

function supportPayload() {
  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          color: 0x6d5dfb,
          title: "🎫 Suporte NexusGames",
          description: "Clique abaixo para abrir um canal privado com a equipe da NexusGames."
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: "support:create-ticket",
              label: "Abrir ticket",
              emoji: { name: "🎫" }
            }
          ]
        }
      ]
    }
  };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CREATED: "🟡 Criado",
    AWAITING_PAYMENT: "🟠 Aguardando pagamento",
    PAID: "🟢 Pago",
    PURCHASING: "🔵 Enviando recarga",
    DELIVERED: "✅ Entregue",
    FAILED: "❌ Falhou",
    MANUAL_REVIEW: "🛠️ Em análise",
    REFUNDED: "↩️ Reembolsado",
    CANCELLED: "⚫ Cancelado"
  };
  return labels[status] || status;
}

function orderLine(order: NexusOrder) {
  const product = getProduct(order.product_id);
  const total = Number(order.total_price_brl || 0);
  return [
    `**${order.order_number}** • ${product?.emoji || "🎮"} ${product?.name || order.product_id}`,
    `${statusLabel(order.status)} • ${total > 0 ? money(total) : "cotação pendente"}`
  ].join("\n");
}

function mercadoPagoStatusText(order: MercadoPagoOrder, sandbox = false) {
  const payment = order.transactions?.payments?.[0];
  const status = order.status || payment?.status || "unknown";
  const detail = order.status_detail || payment?.status_detail || "";
  if (status === "processed" && detail === "accredited") return sandbox ? "✅ Aprovado no sandbox" : "✅ Pagamento aprovado";
  if (status === "action_required") return "⏳ Aguardando pagamento";
  if (status === "processing") return "🔄 Processando";
  if (status === "expired") return "⌛ Expirado";
  if (status === "canceled") return "⚫ Cancelado";
  if (status === "failed") return "❌ Falhou";
  if (status === "refunded") return "↩️ Reembolsado";
  return `ℹ️ ${status}${detail ? ` / ${detail}` : ""}`;
}

function pixSandboxMessageData(orderNumber: string, providerOrder: MercadoPagoOrder) {
  const pix = getPixDetails(providerOrder);
  const components: Array<Record<string, unknown>> = [];
  if (pix.ticketUrl) {
    components.push({ type: 2, style: 5, label: "Abrir Pix de teste", url: pix.ticketUrl, emoji: { name: "🧪" } });
  }
  components.push({ type: 2, style: 1, custom_id: `pix-refresh:${orderNumber}`, label: "Atualizar status", emoji: { name: "🔄" } });
  return {
    embeds: [
      {
        color: 0x00a650,
        title: "🧪 Pix Sandbox Mercado Pago",
        description: [
          `Pedido NexusGames: **${orderNumber}**`,
          `Valor de teste: **${money(MERCADO_PAGO_SANDBOX_AMOUNT_BRL)}**`,
          `Status: **${mercadoPagoStatusText(providerOrder, true)}**`,
          "",
          "⚠️ Este checkout é somente de teste e não movimenta dinheiro real."
        ].join("\n")
      }
    ],
    components: [{ type: 1, components }]
  };
}

function pixLiveMessageData(orderNumber: string, providerOrder: MercadoPagoOrder) {
  const pix = getPixDetails(providerOrder);
  const amount = Number(providerOrder.total_amount || providerOrder.transactions?.payments?.[0]?.amount || 0);
  const components: Array<Record<string, unknown>> = [];
  if (pix.ticketUrl) {
    components.push({ type: 2, style: 5, label: "Abrir Pix", url: pix.ticketUrl, emoji: { name: "💠" } });
  }
  components.push({ type: 2, style: 1, custom_id: `pix-live-refresh:${orderNumber}`, label: "Atualizar status", emoji: { name: "🔄" } });
  const qrText = pix.qrCode ? `\n\n**Pix Copia e Cola:**\n\`${pix.qrCode}\`` : "";
  return {
    embeds: [
      {
        color: 0x00a650,
        title: "💠 Pix NexusGames",
        description: [
          `Pedido: **${orderNumber}**`,
          amount > 0 ? `Valor: **${money(amount)}**` : null,
          `Status: **${mercadoPagoStatusText(providerOrder)}**`,
          pix.expiresAt ? `Expira em: **${pix.expiresAt}**` : null,
          qrText,
          "",
          "A entrega só começa depois que o Mercado Pago confirmar o pagamento."
        ].filter(Boolean).join("\n")
      }
    ],
    components: [{ type: 1, components }]
  };
}

async function syncAndGrantCustomer(providerOrder: MercadoPagoOrder) {
  const synced = await syncMercadoPagoOrder(providerOrder);
  if (synced?.isPaid && synced.discordUserId) {
    await grantCustomerRole(synced.discordUserId).catch((error) => console.error("Nao foi possivel aplicar o cargo Cliente", error));
  }
  return synced;
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

async function processDeferredSandboxPix(params: { customId: string; userId: string; interactionToken: string }) {
  const isCreate = params.customId.startsWith("pix-test:");
  const prefix = isCreate ? "pix-test:" : "pix-refresh:";
  const orderNumber = params.customId.slice(prefix.length);
  try {
    const localOrder = await findDiscordOrderByNumber(params.userId, orderNumber);
    if (!localOrder?.id) throw new Error("Pedido não encontrado.");

    if (localOrder.product_id === "fortnite-account" && isCreate) {
      const validation = await revalidateOrderListing(localOrder.order_number);
      if (!validation.available) {
        const nexusId = String(localOrder.fulfillment_data?.nexus_id || "");
        const alternatives = nexusId
          ? await alternativesForUnavailable({
              nexusId,
              discordUserId: params.userId
            }).catch(() => null)
          : null;

        if (alternatives) {
          await editDeferredInteraction(params.interactionToken, alternatives);
          return;
        }

        throw new Error("A conta ficou indisponível antes do pagamento.");
      }
    }

    const payment = await getMercadoPagoPaymentForOrder(localOrder.id);
    let providerOrder: MercadoPagoOrder;
    if (isCreate) {
      if (payment?.provider_payment_id) providerOrder = await getSandboxOrder(payment.provider_payment_id);
      else {
        providerOrder = await createSandboxPixOrder({ localOrderId: localOrder.id, orderNumber: localOrder.order_number });
        await attachMercadoPagoSandboxOrder({ localOrder, providerOrder });
      }
    } else {
      if (!payment?.provider_payment_id) throw new Error("Este pedido ainda não possui um Pix de teste.");
      providerOrder = await getSandboxOrder(payment.provider_payment_id);
    }
    await syncAndGrantCustomer(providerOrder);
    await editDeferredInteraction(params.interactionToken, pixSandboxMessageData(localOrder.order_number, providerOrder));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ Não foi possível concluir o Pix de teste. ${message}`, embeds: [], components: [] }).catch(() => null);
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

async function processDeferredLivePix(params: {
  orderNumber: string;
  userId: string;
  interactionToken: string;
  payerEmail?: string;
  refresh?: boolean;
}) {
  try {
    if (!realPaymentsReady()) throw new Error("Pagamentos reais ainda não estão habilitados.");
    const localOrder = await findDiscordOrderByNumber(params.userId, params.orderNumber);
    if (!localOrder?.id) throw new Error("Pedido não encontrado.");

    if (localOrder.product_id === "fortnite-account" && !params.refresh) {
      const validation = await revalidateOrderListing(localOrder.order_number);
      if (!validation.available) {
        const nexusId = String(localOrder.fulfillment_data?.nexus_id || "");
        const alternatives = nexusId
          ? await alternativesForUnavailable({
              nexusId,
              discordUserId: params.userId
            }).catch(() => null)
          : null;

        if (alternatives) {
          await editDeferredInteraction(params.interactionToken, alternatives);
          return;
        }

        throw new Error("A conta ficou indisponível antes do pagamento. Faça uma nova busca.");
      }
    }

    const amount = Number(localOrder.total_price_brl || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Pedido ainda não possui preço final válido.");
    const payment = await getMercadoPagoPaymentForOrder(localOrder.id);
    let providerOrder: MercadoPagoOrder;
    if (params.refresh) {
      if (!payment?.provider_payment_id) throw new Error("Este pedido ainda não possui Pix criado.");
      providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    } else if (payment?.provider_payment_id) providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    else {
      if (!params.payerEmail || !validEmail(params.payerEmail)) throw new Error("Informe um e-mail válido para gerar o Pix.");
      providerOrder = await createPixOrder({ mode: "production", localOrderId: localOrder.id, orderNumber: localOrder.order_number, amountBrl: amount, payerEmail: params.payerEmail });
      await attachMercadoPagoSandboxOrder({ localOrder, providerOrder });
    }
    await syncAndGrantCustomer(providerOrder);
    await editDeferredInteraction(params.interactionToken, pixLiveMessageData(localOrder.order_number, providerOrder));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, { content: `❌ Não foi possível gerar/atualizar o Pix. ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

async function processDeferredFinderAction(params: {
  customId: string;
  userId: string;
  username: string;
  interactionId: string;
  interactionToken: string;
}) {
  try {
    const result = await handleFinderAction(params);
    if (!result) throw new Error("Ação do Finder não reconhecida.");
    await editDeferredInteraction(params.interactionToken, result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";

    if (
      params.customId.startsWith("nexus:buy:") &&
      message.toLowerCase().includes("indispon")
    ) {
      const nexusId = params.customId.slice("nexus:buy:".length);
      const alternatives = await alternativesForUnavailable({
        nexusId,
        discordUserId: params.userId,
        discordUsername: params.username
      }).catch(() => null);
      if (alternatives) {
        await editDeferredInteraction(params.interactionToken, alternatives).catch(() => null);
        return;
      }
    }

    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível concluir esta ação. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

async function processDeferredAdminFortnite(params: {
  action: "revalidate" | "delivered";
  orderNumber: string;
  interactionToken: string;
}) {
  try {
    if (params.action === "revalidate") {
      const result = await revalidateOrderListing(params.orderNumber);
      await editDeferredInteraction(params.interactionToken, {
        content: result.available
          ? `✅ ${params.orderNumber}: a oferta continua disponível e foi atualizada.`
          : `⚠️ ${params.orderNumber}: a oferta não está mais disponível. Procure uma alternativa antes da entrega.`,
        embeds: [],
        components: []
      });
      return;
    }

    const delivered = await setOrderDelivered(params.orderNumber);
    await publicSaleReceipt(params.orderNumber).catch(() => null);
    const cashback = Number(delivered.reward?.cashback || 0);
    await editDeferredInteraction(params.interactionToken, {
      content: [
        `✅ Pedido **${params.orderNumber}** marcado como entregue.`,
        cashback > 0 ? `Cashback do cliente: **${money(cashback)}**.` : null
      ].filter(Boolean).join("\n"),
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível atualizar o pedido. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

function livePixEmailModal(orderNumber: string) {
  return {
    type: 9,
    data: {
      custom_id: `pix-live-modal:${orderNumber}`,
      title: "Finalizar pagamento Pix",
      components: [
        {
          type: 1,
          components: [
            { type: 4, custom_id: "payer_email", label: "Seu e-mail", style: 1, min_length: 5, max_length: 180, required: true, placeholder: "voce@email.com" }
          ]
        }
      ]
    }
  };
}

function topupPlayerModal(option: ProductOption) {
  return {
    type: 9,
    data: {
      custom_id: `topup-modal:${option.id}`,
      title: "Validar conta Mobile Legends",
      components: [
        {
          type: 1,
          components: [
            { type: 4, custom_id: "player_id", label: "Player ID", style: 1, min_length: 3, max_length: 20, required: true, placeholder: "Ex.: 123456789" }
          ]
        },
        {
          type: 1,
          components: [
            { type: 4, custom_id: "zone_id", label: "Zone ID", style: 1, min_length: 3, max_length: 20, required: true, placeholder: "Ex.: 1234" }
          ]
        }
      ]
    }
  };
}

function checkoutReadyData(params: {
  option: ProductOption;
  orderNumber: string;
  salePrice: number;
  playerName?: string;
  playerId?: string;
  zoneId?: string;
}) {
  const live = realPaymentsReady();
  return {
    embeds: [
      {
        color: 0x57f287,
        title: live ? "✅ Tudo certo — pronto para pagar" : "✅ Conta validada — checkout de teste",
        description: [
          `${params.option.emoji} **${params.option.name}**`,
          params.playerName ? `Jogador: **${params.playerName}**` : null,
          params.playerId ? `Player ID: **${params.playerId}**` : null,
          params.zoneId ? `Zone ID: **${params.zoneId}**` : null,
          `Pedido: **${params.orderNumber}**`,
          `Preço NexusGames: **${money(params.salePrice)}**`,
          "",
          "✅ conta validada no fornecedor",
          "✅ preço e estoque confirmados",
          "🔐 nunca pedimos sua senha",
          live ? "⚡ recarga iniciada somente após o Pix aprovado" : "🧪 Pix abaixo é sandbox e não movimenta dinheiro"
        ].filter(Boolean).join("\n")
      }
    ],
    components: [
      {
        type: 1,
        components: [
          live
            ? { type: 2, style: 3, custom_id: `pix-live:${params.orderNumber}`, label: `Pagar ${money(params.salePrice)}`, emoji: { name: "💠" } }
            : { type: 2, style: 1, custom_id: `pix-test:${params.orderNumber}`, label: "Testar Pix", emoji: { name: "🧪" } }
        ]
      }
    ]
  };
}

async function processDeferredTopup(params: {
  optionId: string;
  playerId: string;
  zoneId: string;
  userId: string;
  username?: string;
  interactionId: string;
  interactionToken: string;
}) {
  try {
    const option = getProductOption(params.optionId);
    if (!option?.enabled || option.fulfillmentType !== "direct_topup") throw new Error("Oferta indisponível.");
    if (!validGameId(params.playerId) || !validGameId(params.zoneId)) throw new Error("Player ID ou Zone ID inválido.");

    const offer = await getBestSupplierOffer(option.id);
    if (!offer?.supplier_sku || offer.region !== "BR") throw new Error("Oferta Brasil indisponível no momento.");

    const validation = await validateShop2TopupPlayer({
      subCategoryId: Number(offer.supplier_sku),
      requirements: { player_id: params.playerId, zone_id: params.zoneId }
    }) as Record<string, any>;

    const player = validation.player || validation.data?.player || validation.data || {};
    const playerName = String(player.player_name || player.name || "").trim();
    if (validation.success === false) throw new Error("A conta não foi validada pelo fornecedor.");

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
    await editDeferredInteraction(params.interactionToken, checkoutReadyData({
      option,
      orderNumber: result.order.order_number,
      salePrice: quote.salePriceBrl,
      playerName: playerName || undefined,
      playerId: params.playerId,
      zoneId: params.zoneId
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não consegui validar essa conta. ${message}\nConfira o Player ID e o Zone ID e tente novamente.`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

async function processDeferredReview(params: {
  rating: number;
  suffix: string;
  userId: string;
  username: string;
  interactionToken: string;
}) {
  try {
    await recordAndPublishReview({
      discordUserId: params.userId,
      discordUsername: params.username,
      orderNumber: params.suffix === "support" ? null : params.suffix,
      rating: params.rating
    });
    await editDeferredInteraction(params.interactionToken, {
      content: `💜 Obrigado! Sua avaliação de **${params.rating} ⭐** foi registrada.`,
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não consegui registrar sua avaliação. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

async function processDeferredOpenPurchaseTicket(params: {
  orderNumber: string;
  adminId: string;
  adminUsername: string;
  roleIds: string[];
  permissions?: string;
  interactionToken: string;
}) {
  try {
    const staff = await isStaffMember(params.roleIds, params.permissions);
    if (!staff) throw new Error("Apenas a equipe pode abrir tickets de venda.");

    const data = await getOrderForAdmin(params.orderNumber);
    const customerId = String(data?.user?.discord_user_id || "");
    const customerName = String(data?.user?.discord_username || "cliente");
    if (!data?.order || !customerId) throw new Error("Cliente do pedido não encontrado.");

    const ticket = await createSupportTicket(customerId, customerName);
    await ensureTicketStaffAccess(ticket.channelId);
    await patchTicketState(ticket.channelId, {
      source: "purchase",
      order_number: params.orderNumber,
      state: "open"
    }).catch(() => null);

    await postPurchaseTicketSummary(ticket.channelId, params.orderNumber);
    const claim = await claimSupportTicket(ticket.channelId, params.adminId, params.adminUsername);
    const claimText = claim.claimed || claim.alreadyMine
      ? ` Atendimento assumido por <@${params.adminId}>.`
      : ` Atendimento já estava com <@${claim.claimedBy}>.`;

    await editDeferredInteraction(params.interactionToken, {
      content: `✅ Ticket do pedido **${params.orderNumber}**: <#${ticket.channelId}>.${claimText}`,
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível abrir o ticket da venda. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const body = await request.text();
  if (!signature || !timestamp || !verifyDiscordRequest(body, signature, timestamp)) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(body);
  if (interaction.type === 1) return json({ type: 1 });

  after(() => alertOverdueTickets().catch((error) => {
    console.warn("NexusGames: falha ao verificar tickets atrasados", error);
  }));

  const panelInteraction = await maybeHandlePanelInteraction(interaction);
  if (panelInteraction) return json(panelInteraction);

  const actor = interaction.member?.user || interaction.user;
  const earlyCustomId = interaction.data?.custom_id;

  if (interaction.type === 3 && typeof earlyCustomId === "string") {
    if (earlyCustomId.startsWith("finder:open:")) {
      const type = earlyCustomId.slice("finder:open:".length) as "skin" | "pickaxe" | "emote" | "glider" | "best";
      if (!["skin","pickaxe","emote","glider","best"].includes(type)) {
        return json({ type: 4, data: { flags: 64, content: "❌ Tipo de busca inválido." } });
      }
      return json(finderModal(type));
    }

    if (earlyCustomId.startsWith("nexus:buy:")) {
      if (!actor?.id || !interaction.token || !interaction.id) {
        return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua compra." } });
      }
      after(() => processDeferredFinderAction({
        customId: earlyCustomId,
        userId: actor.id,
        username: actor.username || "cliente",
        interactionId: interaction.id,
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("fortnite:open-ticket:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Ação inválida." } });
      }
      after(() => processDeferredOpenPurchaseTicket({
        orderNumber: earlyCustomId.slice("fortnite:open-ticket:".length),
        adminId: actor.id,
        adminUsername: actor.username || "admin",
        roleIds: Array.isArray(interaction.member?.roles) ? interaction.member.roles : [],
        permissions: interaction.member?.permissions,
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("fortnite:revalidate:") || earlyCustomId.startsWith("fortnite:delivered:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Ação inválida." } });
      }
      const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
      const staff = await isStaffMember(roleIds, interaction.member?.permissions);
      if (!staff) return json({ type: 4, data: { flags: 64, content: "⛔ Apenas a equipe pode executar esta ação." } });
      const delivered = earlyCustomId.startsWith("fortnite:delivered:");
      const prefix = delivered ? "fortnite:delivered:" : "fortnite:revalidate:";
      after(() => processDeferredAdminFortnite({
        action: delivered ? "delivered" : "revalidate",
        orderNumber: earlyCustomId.slice(prefix.length),
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("review:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua avaliação." } });
      }
      const [, ratingText, ...suffixParts] = earlyCustomId.split(":");
      const rating = Math.max(1, Math.min(5, Number(ratingText || 0)));
      const suffix = suffixParts.join(":") || "support";
      after(() => processDeferredReview({
        rating,
        suffix,
        userId: actor.id,
        username: actor.username || "cliente",
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("pix-live:") && !earlyCustomId.startsWith("pix-live-refresh:")) return json(livePixEmailModal(earlyCustomId.slice("pix-live:".length)));

    if (earlyCustomId.startsWith("pix-test:") || earlyCustomId.startsWith("pix-refresh:")) {
      if (!actor?.id || !interaction.token) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      after(() => processDeferredSandboxPix({ customId: earlyCustomId, userId: actor.id, interactionToken: interaction.token }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("pix-live-refresh:")) {
      if (!actor?.id || !interaction.token) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      after(() => processDeferredLivePix({ orderNumber: earlyCustomId.slice("pix-live-refresh:".length), userId: actor.id, interactionToken: interaction.token, refresh: true }));
      return json({ type: 5, data: { flags: 64 } });
    }
  }

  if (interaction.type === 5 && typeof earlyCustomId === "string") {
    if (earlyCustomId.startsWith("finder:modal:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua busca." } });
      }
      const itemType = earlyCustomId.slice("finder:modal:".length) as "skin" | "pickaxe" | "emote" | "glider" | "best";
      const input = finderInputFromModal(interaction, itemType);
      after(() => runFinderSearch({
        input: {
          ...input,
          discordUserId: actor.id,
          discordUsername: actor.username || "cliente"
        },
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("topup-modal:")) {
      if (!actor?.id || !interaction.token || !interaction.id) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      const playerId = modalField(interaction, "player_id");
      const zoneId = modalField(interaction, "zone_id");
      if (!validGameId(playerId) || !validGameId(zoneId)) return json({ type: 4, data: { flags: 64, content: "❌ Player ID ou Zone ID inválido. Use apenas números." } });
      after(() => processDeferredTopup({
        optionId: earlyCustomId.slice("topup-modal:".length),
        playerId,
        zoneId,
        userId: actor.id,
        username: actor.username,
        interactionId: interaction.id,
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("pix-live-modal:")) {
      if (!actor?.id || !interaction.token) return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      const email = modalField(interaction, "payer_email");
      if (!validEmail(email)) return json({ type: 4, data: { flags: 64, content: "❌ Informe um e-mail válido." } });
      after(() => processDeferredLivePix({ orderNumber: earlyCustomId.slice("pix-live-modal:".length), userId: actor.id, interactionToken: interaction.token, payerEmail: email }));
      return json({ type: 5, data: { flags: 64 } });
    }
  }

  try {
    if (actor?.id && !actor?.bot) await ensureMemberRole(actor.id).catch((error) => console.error("Nao foi possivel sincronizar o cargo Membro", error));

    if (interaction.type === 2) {
      const name = interaction.data?.name;

      if (name === "buscar") {
        if (!actor?.id || !interaction.token) {
          return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua busca." } });
        }
        const input = finderInputFromCommand(interaction);
        after(() => runFinderSearch({
          input: {
            ...input,
            discordUserId: actor.id,
            discordUsername: actor.username || "cliente"
          },
          interactionToken: interaction.token
        }));
        return json({ type: 5, data: { flags: 64 } });
      }

      if (name === "perfil") {
        if (!actor?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu perfil." } });
        return json({ type: 4, data: { flags: 64, ...(await profilePayload(actor.id, actor.username)) } });
      }

      if (name === "favoritos") {
        if (!actor?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu perfil." } });
        return json({ type: 4, data: { flags: 64, ...(await favoritesPayload(actor.id)) } });
      }

      if (name === "alertas") {
        if (!actor?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu perfil." } });
        return json({ type: 4, data: { flags: 64, ...(await watchesPayload(actor.id)) } });
      }

      if (name === "comparar") {
        if (!actor?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu perfil." } });
        return json({ type: 4, data: { flags: 64, ...(await comparePayload(actor.id)) } });
      }

      if (name === "metricas") {
        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        if (!staff) return json({ type: 4, data: { flags: 64, content: "⛔ Este comando é exclusivo da equipe." } });
        return json({ type: 4, data: { flags: 64, ...(await metricsPayload()) } });
      }

      if (name === "loja") return json(await storeNavigationPayload());
      if (name === "comprar") return json(purchaseCatalogPayload());
      if (name === "pedidos") {
        if (!actor?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu usuário." } });
        const orders = await listDiscordOrders(actor.id, 5);
        return json({ type: 4, data: { flags: 64, embeds: [{ color: 0x6d5dfb, title: "📦 Meus pedidos", description: orders.length ? orders.map(orderLine).join("\n\n") : "Você ainda não possui pedidos na NexusGames." }] } });
      }
      if (name === "suporte") return json(supportPayload());
    }

    if (interaction.type === 3) {
      const customId = interaction.data?.custom_id;

      if (
        typeof customId === "string" &&
        (
          customId.startsWith("nexus:details:") ||
          customId.startsWith("nexus:favorite:") ||
          customId.startsWith("nexus:compare:") ||
          customId === "nexus:compare-clear" ||
          customId === "finder:favorites" ||
          customId === "finder:watches" ||
          customId === "finder:compare" ||
          customId.startsWith("watch:add:") ||
          customId.startsWith("watch:disable:")
        )
      ) {
        const user = interaction.member?.user || interaction.user;
        if (!user?.id || !interaction.id) {
          return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua ação." } });
        }
        const result = await handleFinderAction({
          customId,
          userId: user.id,
          username: user.username || "cliente",
          interactionId: interaction.id
        });
        if (result) return json(result);
      }

      if (
        typeof customId === "string" &&
        (customId.startsWith("fortnite:waiting:") || customId.startsWith("fortnite:transfer:"))
      ) {
        const user = interaction.member?.user || interaction.user;
        const channelId = interaction.channel_id;
        if (!user?.id || !channelId) {
          return json({ type: 4, data: { flags: 64, content: "❌ Ação inválida." } });
        }
        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        if (!staff) return json({ type: 4, data: { flags: 64, content: "⛔ Apenas a equipe pode executar esta ação." } });

        if (customId.startsWith("fortnite:waiting:")) {
          await setSupportTicketWaiting(channelId, user.id);
          return json({ type: 4, data: { flags: 64, content: "⏳ Ticket marcado como aguardando cliente." } });
        }

        await releaseSupportTicket(channelId, user.id);
        return json({ type: 4, data: { flags: 64, content: "🔁 Atendimento liberado para outro admin assumir." } });
      }

      if (customId === "customer:profile") {
        const user = interaction.member?.user || interaction.user;
        if (!user?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu perfil." } });
        return json({ type: 4, data: { flags: 64, ...(await profilePayload(user.id, user.username)) } });
      }

      if (customId === "customer:orders") {
        const user = interaction.member?.user || interaction.user;
        if (!user?.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seus pedidos." } });
        const orders = await listDiscordOrders(user.id, 10);
        return json({
          type: 4,
          data: {
            flags: 64,
            embeds: [{
              color: 0x6d5dfb,
              title: "📦 Meus pedidos",
              description: orders.length ? orders.map(orderLine).join("\n\n") : "Você ainda não possui pedidos na NexusGames."
            }]
          }
        });
      }

      if (customId === "admin:metrics") {
        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        if (!staff) return json({ type: 4, data: { flags: 64, content: "⛔ Este painel é exclusivo da equipe." } });
        return json({ type: 4, data: { flags: 64, ...(await metricsPayload()) } });
      }

      if (customId === "admin:provider-status") {
        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        if (!staff) return json({ type: 4, data: { flags: 64, content: "⛔ Este painel é exclusivo da equipe." } });
        return json({ type: 4, data: { flags: 64, ...(await providerStatusPayload()) } });
      }

      if (customId === "product_select") {
        const categoryId = resolveCategoryId(interaction.data?.values?.[0]);
        if (!categoryId) return json({ type: 4, data: { flags: 64, content: "Categoria indisponível." } });
        return json({ type: 7, data: categoryOptionsData(categoryId) });
      }

      if (typeof customId === "string" && customId.startsWith("buy:")) {
        const requestedId = customId.slice(4);
        const option = getProductOption(requestedId);
        const categoryId = resolveCategoryId(requestedId);
        if (!option && categoryId) return json({ type: 4, data: categoryOptionsData(categoryId) });
        const product = getProduct(requestedId);
        const user = interaction.member?.user || interaction.user;
        if (!option || !product || !product.enabled) return json({ type: 4, data: { flags: 64, content: "❌ Esta opção não está disponível no momento." } });
        if (!user?.id || !interaction.id) return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua compra." } });

        if (option.fulfillmentType === "direct_topup") return json(topupPlayerModal(option));

        const result = await createDiscordOrder({ discordUserId: user.id, discordUsername: user.username, productId: option.id, interactionId: interaction.id });
        if (!result.order.id) throw new Error("Pedido sem ID.");
        const quote = await quoteAndAttachOrder(String(result.order.id), option.id);
        return json({ type: 4, data: { flags: 64, ...checkoutReadyData({ option, orderNumber: result.order.order_number, salePrice: quote.salePriceBrl }) } });
      }

      if (customId === "support:create-ticket") {
        const user = interaction.member?.user || interaction.user;
        const userId = user?.id;
        const username = user?.username || "cliente";
        if (!userId) return json({ type: 4, data: { flags: 64, content: "Não consegui identificar seu usuário." } });
        const ticket = await createSupportTicket(userId, username);
        await ensureTicketStaffAccess(ticket.channelId);
        return json({ type: 4, data: { flags: 64, content: ticket.created ? `✅ Ticket criado: <#${ticket.channelId}>` : `🎫 Você já possui um ticket aberto: <#${ticket.channelId}>` } });
      }

      if (customId === "support:claim-ticket") {
        const user = interaction.member?.user || interaction.user;
        const userId = user?.id;
        const username = user?.username || "admin";
        const channelId = interaction.channel_id;
        if (!userId || !channelId) {
          return json({ type: 4, data: { flags: 64, content: "❌ Não foi possível assumir este ticket." } });
        }

        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        if (!staff) {
          return json({ type: 4, data: { flags: 64, content: "⛔ Apenas a equipe pode assumir tickets." } });
        }

        const claim = await claimSupportTicket(channelId, userId, username);
        if (!claim.claimed && !claim.alreadyMine) {
          return json({
            type: 4,
            data: {
              flags: 64,
              content: `⚠️ Este ticket já foi assumido por <@${claim.claimedBy}>.`
            }
          });
        }

        return json({
          type: 4,
          data: {
            flags: 64,
            content: claim.claimed
              ? "✅ Ticket assumido por você."
              : "✅ Este ticket já está sob sua responsabilidade."
          }
        });
      }

      if (customId === "support:close-ticket") {
        const user = interaction.member?.user || interaction.user;
        const userId = user?.id;
        const channelId = interaction.channel_id;
        if (!userId || !channelId) return json({ type: 4, data: { flags: 64, content: "Não foi possível fechar este ticket." } });
        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);
        await closeSupportTicket(channelId, userId, staff ? "8" : interaction.member?.permissions);
        await ensureTicketStaffAccess(channelId);
        return json({ type: 4, data: { flags: 64, content: "🔒 Ticket fechado com sucesso. O canal foi arquivado para a administração." } });
      }
    }
  } catch (error) {
    console.error("NexusGames interaction error", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({ type: 4, data: { flags: 64, content: `❌ Não foi possível concluir esta ação. ${message}` } });
  }

  return json({ type: 4, data: { flags: 64, content: "Comando ainda não implementado." } });
}
