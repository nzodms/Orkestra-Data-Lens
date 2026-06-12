import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/env";
import { ensureWebPixel } from "@/lib/server/pixel";
import { getConnectedShop } from "@/lib/server/repo";

/**
 * POST /api/shopify/pixel — (ré)installe le Web Pixel sur la boutique
 * connectée via webPixelCreate / webPixelUpdate. Utilisé par le bouton
 * « Réinstaller le pixel » de Settings.
 */
export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { mode: "demo", error: "Aucune base configurée : pixel en mode démo." },
      { status: 409 }
    );
  }
  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json(
      { mode: "demo", error: "Aucune boutique connectée." },
      { status: 409 }
    );
  }

  const result = await ensureWebPixel(shop);
  return NextResponse.json(
    { mode: "live", shop: shop.shopify_domain, ...result },
    { status: result.status === "installed" ? 200 : 502 }
  );
}
