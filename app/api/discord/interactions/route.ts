import nacl from "tweetnacl";
import { after } from "next/server";
import {
  getProduct,
  getProductOption,
  getProductOptions,
  products,
  resolveCategoryId
} from "../../../../lib/catalog";
import {
  closeSupportTicket,
  createSupportTicket,
  getStoreNavigation
} from "../../../../lib/discord";
import { maybeHandlePanelInteraction } from "../../../../lib/panelEditor";
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
          title: "🛒 Catálogo rápido NexusGames",
          description: [
            "Escolha uma categoria abaixo.",
            "",
            "Depois você escolhe a quantidade/valor exato do produto.",
            "Preço, região e estoque são validados antes de qualquer pagamento real."
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
          realPaymentsReady()
            ? "⚡ O preço final será calculado com a oferta em estoque antes de abrir o Pix."
            : "🧪 Pagamentos reais continuam bloqueados; o Pix disponível é somente sandbox."
        ].join("\n")
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
    PURCHASING: "🔵 Comprando no fornecedor",
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
  const price = total > 0 ? money(total) : "cotação pendente";

  return [
    `**${order.order_number}** • ${product?.emoji || "🎮"} ${product?.name || order.product_id}`,
    `${statusLabel(order.status)} • ${price}`
  ].join("\n");
}

function mercadoPagoStatusText(order: MercadoPagoOrder, sandbox = false) {
  const payment = order.transactions?.payments?.[0];
  const status = order.status || payment?.status || "unknown";
  const detail = order.status_detail || payment?.status_detail || "";

  if (status === "processed" && detail === "accredited") {
    return sandbox ? "✅ Aprovado no sandbox" : "✅ Pagamento aprovado";
  }
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
    components.push({
      type: 2,
      style: 5,
      label: "Abrir Pix de teste",
      url: pix.ticketUrl,
      emoji: { name: "🧪" }
    });
  }

  components.push({
    type: 2,
    style: 1,
    custom_id: `pix-refresh:${orderNumber}`,
    label: "Atualizar status",
    emoji: { name: "🔄" }
  });

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
    components.push({
      type: 2,
      style: 5,
      label: "Abrir Pix",
      url: pix.ticketUrl,
      emoji: { name: "💠" }
    });
  }

  components.push({
    type: 2,
    style: 1,
    custom_id: `pix-live-refresh:${orderNumber}`,
    label: "Atualizar status",
    emoji: { name: "🔄" }
  });

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
    await grantCustomerRole(synced.discordUserId).catch((error) => {
      console.error("Nao foi possivel aplicar o cargo Cliente", error);
    });
  }
  return synced;
}

async function editDeferredInteraction(
  interactionToken: string,
  data: Record<string, unknown>
) {
  const response = await fetch(
    `${DISCORD_API}/webhooks/${APPLICATION_ID}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function processDeferredSandboxPix(params: {
  customId: string;
  userId: string;
  interactionToken: string;
}) {
  const isCreate = params.customId.startsWith("pix-test:");
  const prefix = isCreate ? "pix-test:" : "pix-refresh:";
  const orderNumber = params.customId.slice(prefix.length);

  try {
    const localOrder = await findDiscordOrderByNumber(params.userId, orderNumber);
    if (!localOrder?.id) throw new Error("Pedido não encontrado.");

    const payment = await getMercadoPagoPaymentForOrder(localOrder.id);
    let providerOrder: MercadoPagoOrder;

    if (isCreate) {
      if (payment?.provider_payment_id) {
        providerOrder = await getSandboxOrder(payment.provider_payment_id);
      } else {
        providerOrder = await createSandboxPixOrder({
          localOrderId: localOrder.id,
          orderNumber: localOrder.order_number
        });
        await attachMercadoPagoSandboxOrder({ localOrder, providerOrder });
      }
    } else {
      if (!payment?.provider_payment_id) {
        throw new Error("Este pedido ainda não possui um Pix de teste.");
      }
      providerOrder = await getSandboxOrder(payment.provider_payment_id);
    }

    await syncAndGrantCustomer(providerOrder);
    await editDeferredInteraction(
      params.interactionToken,
      pixSandboxMessageData(localOrder.order_number, providerOrder)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("NexusGames sandbox Pix error", message);
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível concluir o Pix de teste. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

function modalEmail(interaction: Record<string, any>) {
  const rows = Array.isArray(interaction.data?.components) ? interaction.data.components : [];
  for (const row of rows) {
    const components = Array.isArray(row?.components) ? row.components : [];
    for (const component of components) {
      if (component?.custom_id === "payer_email") return String(component.value || "").trim();
    }
  }
  return "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

async function processDeferredLivePix(params: {
  orderNumber: string;
  userId: string;
  interactionToken: string;
  payerEmail?: string;
  refresh?: boolean;
}) {
  try {
    if (!realPaymentsReady()) {
      throw new Error("Pagamentos reais ainda não estão habilitados.");
    }

    const localOrder = await findDiscordOrderByNumber(params.userId, params.orderNumber);
    if (!localOrder?.id) throw new Error("Pedido não encontrado.");

    const amount = Number(localOrder.total_price_brl || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Pedido ainda não possui preço final válido.");
    }

    const payment = await getMercadoPagoPaymentForOrder(localOrder.id);
    let providerOrder: MercadoPagoOrder;

    if (params.refresh) {
      if (!payment?.provider_payment_id) {
        throw new Error("Este pedido ainda não possui Pix criado.");
      }
      providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    } else if (payment?.provider_payment_id) {
      providerOrder = await getMercadoPagoOrder(payment.provider_payment_id, "production");
    } else {
      if (!params.payerEmail || !validEmail(params.payerEmail)) {
        throw new Error("Informe um e-mail válido para gerar o Pix.");
      }

      providerOrder = await createPixOrder({
        mode: "production",
        localOrderId: localOrder.id,
        orderNumber: localOrder.order_number,
        amountBrl: amount,
        payerEmail: params.payerEmail
      });
      await attachMercadoPagoSandboxOrder({ localOrder, providerOrder });
    }

    await syncAndGrantCustomer(providerOrder);
    await editDeferredInteraction(
      params.interactionToken,
      pixLiveMessageData(localOrder.order_number, providerOrder)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("NexusGames live Pix error", message);
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível gerar/atualizar o Pix. ${message}`,
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
            {
              type: 4,
              custom_id: "payer_email",
              label: "Seu e-mail",
              style: 1,
              min_length: 5,
              max_length: 180,
              required: true,
              placeholder: "voce@email.com"
            }
          ]
        }
      ]
    }
  };
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const body = await request.text();

  if (!signature || !timestamp || !verifyDiscordRequest(body, signature, timestamp)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  if (interaction.type === 1) return json({ type: 1 });

  const panelInteraction = await maybeHandlePanelInteraction(interaction);
  if (panelInteraction) return json(panelInteraction);

  const actor = interaction.member?.user || interaction.user;
  const earlyCustomId = interaction.data?.custom_id;

  if (interaction.type === 3 && typeof earlyCustomId === "string") {
    if (earlyCustomId.startsWith("pix-live:") && !earlyCustomId.startsWith("pix-live-refresh:")) {
      return json(livePixEmailModal(earlyCustomId.slice("pix-live:".length)));
    }

    if (earlyCustomId.startsWith("pix-test:") || earlyCustomId.startsWith("pix-refresh:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      }
      after(() => processDeferredSandboxPix({
        customId: earlyCustomId,
        userId: actor.id,
        interactionToken: interaction.token
      }));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (earlyCustomId.startsWith("pix-live-refresh:")) {
      if (!actor?.id || !interaction.token) {
        return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
      }
      after(() => processDeferredLivePix({
        orderNumber: earlyCustomId.slice("pix-live-refresh:".length),
        userId: actor.id,
        interactionToken: interaction.token,
        refresh: true
      }));
      return json({ type: 5, data: { flags: 64 } });
    }
  }

  if (
    interaction.type === 5 &&
    typeof earlyCustomId === "string" &&
    earlyCustomId.startsWith("pix-live-modal:")
  ) {
    if (!actor?.id || !interaction.token) {
      return json({ type: 4, data: { flags: 64, content: "❌ Operação inválida." } });
    }

    const email = modalEmail(interaction);
    if (!validEmail(email)) {
      return json({
        type: 4,
        data: { flags: 64, content: "❌ Informe um e-mail válido." }
      });
    }

    after(() => processDeferredLivePix({
      orderNumber: earlyCustomId.slice("pix-live-modal:".length),
      userId: actor.id,
      interactionToken: interaction.token,
      payerEmail: email
    }));
    return json({ type: 5, data: { flags: 64 } });
  }

  try {
    if (actor?.id && !actor?.bot) {
      await ensureMemberRole(actor.id).catch((error) => {
        console.error("Nao foi possivel sincronizar o cargo Membro", error);
      });
    }

    if (interaction.type === 2) {
      const name = interaction.data?.name;

      if (name === "loja") return json(await storeNavigationPayload());
      if (name === "comprar") return json(purchaseCatalogPayload());

      if (name === "pedidos") {
        if (!actor?.id) {
          return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar seu usuário." } });
        }

        const orders = await listDiscordOrders(actor.id, 5);
        return json({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                color: 0x6d5dfb,
                title: "📦 Meus pedidos",
                description: orders.length
                  ? orders.map(orderLine).join("\n\n")
                  : "Você ainda não possui pedidos na NexusGames."
              }
            ]
          }
        });
      }

      if (name === "suporte") return json(supportPayload());
    }

    if (interaction.type === 3) {
      const customId = interaction.data?.custom_id;

      if (customId === "product_select") {
        const categoryId = resolveCategoryId(interaction.data?.values?.[0]);
        if (!categoryId) {
          return json({ type: 4, data: { flags: 64, content: "Categoria indisponível." } });
        }
        return json({ type: 7, data: categoryOptionsData(categoryId) });
      }

      if (typeof customId === "string" && customId.startsWith("buy:")) {
        const requestedId = customId.slice(4);
        const option = getProductOption(requestedId);
        const categoryId = resolveCategoryId(requestedId);

        if (!option && categoryId) {
          return json({ type: 4, data: categoryOptionsData(categoryId) });
        }

        const product = getProduct(requestedId);
        const user = interaction.member?.user || interaction.user;

        if (!option || !product || !product.enabled) {
          return json({
            type: 4,
            data: { flags: 64, content: "❌ Esta opção não está disponível no momento." }
          });
        }

        if (!user?.id || !interaction.id) {
          return json({ type: 4, data: { flags: 64, content: "❌ Não consegui identificar sua compra." } });
        }

        const result = await createDiscordOrder({
          discordUserId: user.id,
          discordUsername: user.username,
          productId: option.id,
          interactionId: interaction.id
        });

        if (realPaymentsReady()) {
          try {
            const quote = await quoteAndAttachOrder(String(result.order.id), option.id);
            return json({
              type: 4,
              data: {
                flags: 64,
                embeds: [
                  {
                    color: 0x57f287,
                    title: "✅ Pedido pronto para pagamento",
                    description: [
                      `${option.emoji} **${option.name}**`,
                      `Pedido: **${result.order.order_number}**`,
                      `Preço final: **${money(quote.salePriceBrl)}**`,
                      "",
                      "✅ estoque do fornecedor confirmado",
                      "✅ preço calculado antes da cobrança",
                      "🔐 compra no fornecedor somente após o Pix aprovado"
                    ].join("\n")
                  }
                ],
                components: [
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 3,
                        custom_id: `pix-live:${result.order.order_number}`,
                        label: `Pagar ${money(quote.salePriceBrl)}`,
                        emoji: { name: "💠" }
                      }
                    ]
                  }
                ]
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Cotação indisponível";
            return json({
              type: 4,
              data: {
                flags: 64,
                content: `⚠️ Pedido criado, mas o pagamento não foi liberado: ${message}`
              }
            });
          }
        }

        return json({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                color: 0x57f287,
                title: result.created ? "✅ Pedido de teste criado" : "📦 Pedido já registrado",
                description: [
                  `${option.emoji} **${option.name}**`,
                  `Pedido: **${result.order.order_number}**`,
                  "",
                  "🔒 Pagamento real está bloqueado nesta fase.",
                  "🧪 Use o Pix sandbox para validar o fluxo sem movimentar dinheiro."
                ].join("\n")
              }
            ],
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    custom_id: `pix-test:${result.order.order_number}`,
                    label: "Gerar Pix de teste",
                    emoji: { name: "🧪" }
                  }
                ]
              }
            ]
          }
        });
      }

      if (customId === "support:create-ticket") {
        const user = interaction.member?.user || interaction.user;
        const userId = user?.id;
        const username = user?.username || "cliente";

        if (!userId) {
          return json({ type: 4, data: { flags: 64, content: "Não consegui identificar seu usuário." } });
        }

        const ticket = await createSupportTicket(userId, username);
        await ensureTicketStaffAccess(ticket.channelId);

        return json({
          type: 4,
          data: {
            flags: 64,
            content: ticket.created
              ? `✅ Ticket criado: <#${ticket.channelId}>`
              : `🎫 Você já possui um ticket aberto: <#${ticket.channelId}>`
          }
        });
      }

      if (customId === "support:close-ticket") {
        const user = interaction.member?.user || interaction.user;
        const userId = user?.id;
        const channelId = interaction.channel_id;

        if (!userId || !channelId) {
          return json({ type: 4, data: { flags: 64, content: "Não foi possível fechar este ticket." } });
        }

        const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
        const staff = await isStaffMember(roleIds, interaction.member?.permissions);

        await closeSupportTicket(
          channelId,
          userId,
          staff ? "8" : interaction.member?.permissions
        );
        await ensureTicketStaffAccess(channelId);

        return json({
          type: 4,
          data: {
            flags: 64,
            content: "🔒 Ticket fechado com sucesso. O canal foi arquivado para a administração."
          }
        });
      }
    }
  } catch (error) {
    console.error("NexusGames interaction error", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({
      type: 4,
      data: {
        flags: 64,
        content: `❌ Não foi possível concluir esta ação. ${message}`
      }
    });
  }

  return json({
    type: 4,
    data: { flags: 64, content: "Comando ainda não implementado." }
  });
}
