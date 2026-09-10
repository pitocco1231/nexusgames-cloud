import nacl from "tweetnacl";
import { after } from "next/server";
import { getProduct, products } from "../../../../lib/catalog";
import {
  closeSupportTicket,
  createSupportTicket,
  getStoreNavigation
} from "../../../../lib/discord";
import {
  createSandboxPixOrder,
  getPixDetails,
  getSandboxOrder,
  MERCADO_PAGO_SANDBOX_AMOUNT_BRL,
  type MercadoPagoOrder
} from "../../../../lib/mercadopago";
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
            "Escolha um produto abaixo para iniciar a compra.",
            "",
            "Você também pode entrar diretamente nos canais da categoria em **🎮・PRODUTOS**.",
            "",
            "Antes do pagamento real, o sistema validará disponibilidade, região e preço."
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
              placeholder: "Escolha um produto",
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
            "A loja agora é organizada por canais. Clique na categoria que você procura:",
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
  const price = total > 0 ? `R$ ${total.toFixed(2).replace(".", ",")}` : "cotação pendente";

  return [
    `**${order.order_number}** • ${product?.emoji || "🎮"} ${product?.name || order.product_id}`,
    `${statusLabel(order.status)} • ${price}`
  ].join("\n");
}

function mercadoPagoStatusText(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  const status = order.status || payment?.status || "unknown";
  const detail = order.status_detail || payment?.status_detail || "";

  if (status === "processed" && detail === "accredited") return "✅ Aprovado no sandbox";
  if (status === "action_required") return "⏳ Aguardando simulação do Pix";
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
          `Valor de teste: **R$ ${MERCADO_PAGO_SANDBOX_AMOUNT_BRL.toFixed(2).replace(".", ",")}**`,
          `Status: **${mercadoPagoStatusText(providerOrder)}**`,
          "",
          "⚠️ Este checkout é somente de teste e não movimenta dinheiro real.",
          "No teste oficial do Pix, o Mercado Pago atualiza a order automaticamente para aprovada."
        ].join("\n")
      }
    ],
    components: [{ type: 1, components }]
  };
}

function pixSandboxPayload(orderNumber: string, providerOrder: MercadoPagoOrder) {
  return {
    type: 4,
    data: {
      flags: 64,
      ...pixSandboxMessageData(orderNumber, providerOrder)
    }
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

async function processDeferredPix(params: {
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
    console.error("NexusGames deferred Pix error", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferredInteraction(params.interactionToken, {
      content: `❌ Não foi possível concluir o Pix de teste. ${message}`,
      embeds: [],
      components: []
    }).catch((editError) => {
      console.error("Nao foi possivel editar a resposta adiada do Discord", editError);
    });
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const body = await request.text();

  if (!signature || !timestamp || !verifyDiscordRequest(body, signature, timestamp)) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  const earlyCustomId = interaction.type === 3 ? interaction.data?.custom_id : null;
  if (
    typeof earlyCustomId === "string" &&
    (earlyCustomId.startsWith("pix-test:") || earlyCustomId.startsWith("pix-refresh:"))
  ) {
    const user = interaction.member?.user || interaction.user;
    if (!user?.id || !interaction.token) {
      return json({
        type: 4,
        data: { flags: 64, content: "❌ Não consegui identificar esta operação." }
      });
    }

    after(async () => {
      await processDeferredPix({
        customId: earlyCustomId,
        userId: user.id,
        interactionToken: interaction.token
      });
    });

    return json({ type: 5, data: { flags: 64 } });
  }

  try {
    const actor = interaction.member?.user || interaction.user;
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
          return json({
            type: 4,
            data: { flags: 64, content: "❌ Não consegui identificar seu usuário." }
          });
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

      if (name === "suporte") {
        return json(supportPayload());
      }
    }

    if (interaction.type === 3) {
      const customId = interaction.data?.custom_id;

      if (customId === "product_select") {
        const product = getProduct(interaction.data?.values?.[0]);
        if (!product || !product.enabled) {
          return json({
            type: 4,
            data: { flags: 64, content: "Produto não encontrado ou indisponível." }
          });
        }

        return json({
          type: 7,
          data: {
            embeds: [
              {
                color: 0x6d5dfb,
                title: `${product.emoji} ${product.name}`,
                description: [
                  product.description,
                  "",
                  "🔎 Preço e estoque serão consultados antes do checkout real.",
                  "🔐 A key será entregue somente de forma privada."
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
                    custom_id: `buy:${product.id}`,
                    label: "Comprar",
                    emoji: { name: "🛒" }
                  }
                ]
              }
            ]
          }
        });
      }

      if (typeof customId === "string" && customId.startsWith("buy:")) {
        const product = getProduct(customId.slice(4));
        const user = interaction.member?.user || interaction.user;

        if (!product || !product.enabled) {
          return json({
            type: 4,
            data: { flags: 64, content: "❌ Este produto não está disponível no momento." }
          });
        }

        if (!user?.id || !interaction.id) {
          return json({
            type: 4,
            data: { flags: 64, content: "❌ Não consegui identificar sua compra." }
          });
        }

        const result = await createDiscordOrder({
          discordUserId: user.id,
          discordUsername: user.username,
          productId: product.id,
          interactionId: interaction.id
        });

        return json({
          type: 4,
          data: {
            flags: 64,
            embeds: [
              {
                color: 0x57f287,
                title: result.created ? "✅ Pedido criado" : "📦 Pedido já registrado",
                description: [
                  `${product.emoji} **${product.name}**`,
                  `Pedido: **${result.order.order_number}**`,
                  "",
                  "🔒 Nenhum pagamento real será cobrado nesta fase.",
                  "🧪 O próximo botão gera o Pix oficial de teste do Mercado Pago."
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
          return json({
            type: 4,
            data: { flags: 64, content: "Não consegui identificar seu usuário." }
          });
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
          return json({
            type: 4,
            data: { flags: 64, content: "Não foi possível fechar este ticket." }
          });
        }

        const roleIds = Array.isArray(interaction.member?.roles)
          ? interaction.member.roles
          : [];
        const staff = await isStaffMember(
          roleIds,
          interaction.member?.permissions
        );

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
