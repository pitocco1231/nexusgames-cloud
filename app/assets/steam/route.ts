import { createBannerResponse } from "../../../lib/bannerImage";

export const runtime = "edge";

export function GET() {
  return createBannerResponse("steam");
}
