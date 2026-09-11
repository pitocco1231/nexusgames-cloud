import { nexusIconResponse } from "../../../lib/nexusIcon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return nexusIconResponse();
}
