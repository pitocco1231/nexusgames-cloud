import nacl from "tweetnacl";
import { getProduct, products } from "../../../../lib/catalog";

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

function shopPayload() {
  const enabled = products.filter((p) => p.enabled);

  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          title: "🛒 NexusGames",
          description: [
            "Escolha um produto abaixo.",
            "",
            "Antes do pagamento, o sistema vai validar disponibilidade, regiao e margem.",
            "A entrega automatica sera ativada quando o fornecedor e o Pix estiverem conectados."
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
              options: enabled.map((p) => ({
                label: p.name,
                value: p.id,
                description: p.description.slice(0, 90),
                emoji: { name: p.emoji }
              }))
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

  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  if (interaction.type === 2) {
    const name = interaction.data?.name;

    if (name === "loja" || name === "comprar") return json(shopPayload());

    if (name === "pedidos") {
      return json({
        type: 4,
        data: {
          flags: 64,
          content: "📦 O historico de pedidos sera conectado ao banco na proxima etapa."
        }
      });
    }

    if (name === "suporte") {
      return json({
        type: 4,
        data: {
          flags: 64,
          content: "🎫 Use o canal **#suporte** da NexusGames."
        }
      });
    }
  }

  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id;

    if (customId === "product_select") {
      const product = getProduct(interaction.data?.values?.[0]);
      if (!product) {
        return json({ type: 4, data: { flags: 64, content: "Produto nao encontrado." } });
      }

      return json({
        type: 7,
        data: {
          embeds: [
            {
              title: `${product.emoji} ${product.name}`,
              description: [
                product.description,
                "",
                "🔎 Preco e estoque serao consultados antes do checkout.",
                "🔐 A key sera entregue somente de forma privada."
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
                  label: "Comprar"
                }
              ]
            }
          ]
        }
      });
    }

    if (typeof customId === "string" && customId.startsWith("buy:")) {
      const product = getProduct(customId.slice(4));
      return json({
        type: 4,
        data: {
          flags: 64,
          content: `🚧 Checkout de **${product?.name || "produto"}** preparado. O Pix e o fornecedor serao conectados na proxima etapa.`
        }
      });
    }
  }

  return json({ type: 4, data: { flags: 64, content: "Comando ainda nao implementado." } });
}
