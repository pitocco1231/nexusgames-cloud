import { finalizeStore } from "../../../../../lib/storeFinalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint temporário de execução única; removido após organizar a loja.
export async function GET() {
  try {
    const result = await finalizeStore();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames one-shot finalizer failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
