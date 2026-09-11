import { POST as handleDiscordInteraction } from "./handler";
import { getCachedPixQr } from "../../../../lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NexusGlobal = typeof globalThis & {
  __nexusPixFetchPatched?: boolean;
};

function extractOrderNumber(payload: Record<string, any>) {
  const description = String(payload?.embeds?.[0]?.description || "");
  const match = description.match(/Pedido(?: NexusGames)?: \*\*([^*]+)\*\*/);
  return match?.[1]?.trim() || "";
}

function withQrAttachment(payload: Record<string, any>, qrBase64: string) {
  const raw = qrBase64.replace(/^data:image\/[^;]+;base64,/, "");
  const png = Buffer.from(raw, "base64");
  if (!png.length) return null;

  const embeds = Array.isArray(payload.embeds)
    ? payload.embeds.map((embed: Record<string, any>, index: number) =>
        index === 0
          ? { ...embed, image: { url: "attachment://pix-qrcode.png" } }
          : embed
      )
    : [];

  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    ...payload,
    embeds,
    attachments: [{ id: 0, filename: "pix-qrcode.png", description: "QR Code Pix NexusGames" }]
  }));
  form.append("files[0]", new Blob([png], { type: "image/png" }), "pix-qrcode.png");
  return form;
}

const nexusGlobal = globalThis as NexusGlobal;
if (!nexusGlobal.__nexusPixFetchPatched) {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      const isDiscordEdit =
        url.startsWith("https://discord.com/api/v10/webhooks/") &&
        url.endsWith("/messages/@original") &&
        String(init?.method || "GET").toUpperCase() === "PATCH" &&
        typeof init?.body === "string";

      if (isDiscordEdit) {
        const headers = new Headers(init?.headers || {});
        if ((headers.get("content-type") || "").includes("application/json")) {
          const payload = JSON.parse(String(init?.body || "{}"));
          const title = String(payload?.embeds?.[0]?.title || "");
          const isPix = title.includes("Pix NexusGames") || title.includes("Pix Sandbox Mercado Pago");
          if (isPix) {
            const orderNumber = extractOrderNumber(payload);
            const qrBase64 = orderNumber ? getCachedPixQr(orderNumber) : null;
            if (qrBase64) {
              const form = withQrAttachment(payload, qrBase64);
              if (form) {
                headers.delete("content-type");
                return originalFetch(input, { ...init, headers, body: form });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Pix QR attachment fallback", error);
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  nexusGlobal.__nexusPixFetchPatched = true;
}

export async function POST(request: Request) {
  return handleDiscordInteraction(request);
}
