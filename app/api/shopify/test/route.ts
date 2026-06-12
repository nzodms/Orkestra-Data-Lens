import { NextResponse } from "next/server";
import { isDatabaseConfigured, SHOPIFY_API_VERSION } from "@/lib/server/env";
import { getAccessToken, getConnectedShop, updateShopApiCheck } from "@/lib/server/repo";
import { testConnection } from "@/lib/server/shopify";

/**
 * POST /api/shopify/test — re-teste la connexion de la boutique enregistrée
 * (requêtes réelles Shopify) et met à jour api_status / api_error /
 * last_api_check_at. Le token n'est jamais renvoyé.
 */
export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Aucune base configurée." }, { status: 409 });
  }
  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Aucune boutique connectée." }, { status: 409 });
  }
  const token = await getAccessToken(shop.id);
  if (!token) {
    await updateShopApiCheck(shop.id, false, "Token manquant ou indéchiffrable.");
    return NextResponse.json({ ok: false, error: "Token manquant — reconnectez la boutique." }, { status: 422 });
  }

  const result = await testConnection(shop.shopify_domain, token, shop.api_version ?? SHOPIFY_API_VERSION);
  await updateShopApiCheck(shop.id, result.ok, result.error);

  return NextResponse.json({
    ok: result.ok,
    shopName: result.shopName,
    scopes: result.scopes,
    missingScopes: result.missingScopes,
    error: result.error,
  });
}
