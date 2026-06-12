import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/server/env";
import { getConnectedShop, setDataMode } from "@/lib/server/repo";

/**
 * POST /api/shopify/mode — bascule explicite démo / live.
 * En « demo », la boutique reste connectée mais l'interface affiche les
 * données de démonstration (badge « Mode démo » partout) — jamais de
 * mélange silencieux.
 */
const schema = z.object({ mode: z.enum(["live", "demo"]) });

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Aucune base configurée." }, { status: 409 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Mode invalide." }, { status: 400 });
  }
  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Aucune boutique connectée." }, { status: 409 });
  }
  await setDataMode(shop.id, parsed.data.mode);
  return NextResponse.json({ ok: true, mode: parsed.data.mode });
}
