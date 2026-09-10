import nacl from "tweetnacl";
import { getProduct, products } from "../../../../lib/catalog";
import {
  closeSupportTicket,
  createSupportTicket,
  getStoreNavigation
} from "../../../../lib/discord";
import {
  ensureMemberRole,
  ensureTicketStaffAccess,
  isStaffMember
} from "../../../../lib/roles";
import {
  createDiscordOrder,
  listDiscordOrders,
  type NexusOrder
} from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_KEY_ENV = "DISCORD_PUBLIC_KEY";

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
            "Antes do pagamento, o sistema validará disponibilidade, região e preço."
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
    MANUAL_REVIEW: "🛠️ Em análise"
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
                  "🔎 Preço e estoque serão consultados antes do checkout.",
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
                  "💰 Valor: **cotação pendente**",
                  "🔒 Nenhum pagamento foi cobrado ainda.",
                  "",
                  "O Pix será liberado somente depois da validação de preço e estoque. Use `/pedidos` para acompanhar."
                ].join("\n")
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
