import { neonBannerResponse } from "../../../lib/neonBanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return neonBannerResponse(name);
}
