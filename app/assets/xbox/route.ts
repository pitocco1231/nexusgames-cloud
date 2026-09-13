import { artResponse } from "../../../lib/storeArt";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(){ return artResponse("xbox"); }
