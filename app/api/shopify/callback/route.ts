import { NextRequest, NextResponse } from "next/server";
import { verifySignedState } from "@/lib/server/crypto";
import { isDatabaseConfigured, isOAuthConfigured } from "@/lib/server/env";
import { ensureWebPixel } from "@/lib/server/pixel";
import { upsertConnectedShop } from "@/lib/server/repo";
import {
  exchangeCodeForToken,
  fetchShopInfo,
  normalizeShopDomain,
  registerWebhooks,
  verifyOAuthHmac,
} from "@/lib/server/shopify";

/**
 * Callback OAuth Shopify.
 *
 * Vérifie le HMAC + le state anti-CSRF, échange le code contre un access
 * token, stocke le token chiffré (AES-256-GCM) puis enregistre les webhooks.
 * Redirige vers l'onboarding avec un statut explicite — jamais de faux
 * « connecté » si une étape échoue.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/onboarding?step=1&error=${code}`, req.nextUrl.origin));

  if (!isOAuthConfigured() || !isDatabaseConfigured()) return fail("not_configured");

  // 1. Authenticité de la requête (HMAC calculé sur la query string)
  if (!verifyOAuthHmac(params)) {
    console.warn("[oauth] HMAC de callback invalide");
    return fail("invalid_hmac");
  }

  // 2. Anti-CSRF : le state doit correspondre au cookie signé
  const state = params.get("state") ?? "";
  const cookieState = req.cookies.get("orkestra_oauth_state")?.value ?? "";
  const verified = verifySignedState(state);
  if (!verified || state !== cookieState) {
    console.warn("[oauth] State anti-CSRF invalide ou expiré");
    return fail("invalid_state");
  }

  const shopDomain = normalizeShopDomain(params.get("shop") ?? "");
  if (!shopDomain || shopDomain !== verified.shopDomain) return fail("shop_mismatch");

  const code = params.get("code");
  if (!code) return fail("missing_code");

  try {
    // 3. Échange code → access token
    const { accessToken, scopes } = await exchangeCodeForToken(shopDomain, code);

    // 4. Infos boutique (nom, devise, fuseau) — non bloquant si refusé
    let info: { name?: string; currencyCode?: string; ianaTimezone?: string } = {};
    try {
      info = await fetchShopInfo(shopDomain, accessToken);
    } catch (err) {
      console.warn("[oauth] fetchShopInfo a échoué :", err instanceof Error ? err.message : err);
    }

    // 5. Persistance : shop + token chiffré + scopes accordés
    const shop = await upsertConnectedShop({
      domain: shopDomain,
      name: info.name,
      currency: info.currencyCode,
      timezone: info.ianaTimezone,
      scopes,
      accessToken,
    });

    // 6. Webhooks (orders, refunds, app/uninstalled)
    const webhookResult = await registerWebhooks(shopDomain, accessToken);
    if (webhookResult.errors.length > 0) {
      console.warn(`[oauth] Webhooks partiellement enregistrés pour ${shopDomain} :`, webhookResult.errors);
    }

    // 7. Activation automatique du Web Pixel (scope write_pixels).
    // Non bloquant : en cas d'échec, le statut réel (« error ») est stocké
    // et visible dans Settings, avec le bouton « Réinstaller le pixel ».
    const pixel = await ensureWebPixel(shop);
    if (pixel.status === "error") {
      console.warn(`[oauth] Pixel non installé pour ${shopDomain} : ${pixel.error}`);
    }

    console.log(`[oauth] Boutique connectée : ${shopDomain} (shop_id=${shop.id}, scopes=${scopes})`);

    const response = NextResponse.redirect(
      new URL(`/onboarding?step=3&connected=1&shop=${encodeURIComponent(shopDomain)}`, req.nextUrl.origin)
    );
    response.cookies.delete("orkestra_oauth_state");
    return response;
  } catch (err) {
    console.error("[oauth] Échec de connexion :", err instanceof Error ? err.message : err);
    return fail("token_exchange_failed");
  }
}
