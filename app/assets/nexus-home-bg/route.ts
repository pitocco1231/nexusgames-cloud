import { originalBackground } from "../../../lib/originalBackgrounds";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){return originalBackground("home" as "home"|"login");}
