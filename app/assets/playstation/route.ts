import { neonBannerResponse } from "../../../lib/neonBanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return neonBannerResponse("playstation");
}
