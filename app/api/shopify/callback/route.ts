import { NextRequest, NextResponse } from "next/server";
import { hashOAuthState } from "@/lib/server/crypto";
import { isDatabaseConfigured, isManualConnectAvailable } from "@/lib/server/env";
import { ensureWebPixel } from "@/lib/server/pixel";
import { consumeOAuthState, resolveOAuthCredentials, upsertConnectedShop } from "@/lib/server/repo";
import {
  exchangeCodeForToken,
  fetchShopInfo,
  normalizeShopDomain,
  registerWebhooks,
  verifyOAuthHmac,
} from "@/lib/server/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback OAuth Shopify.
 *
 * Vérifie le HMAC + le state anti-CSRF (stocké EN BASE, pas en cookie),
 * échange le code contre un access token, stocke le token chiffré
 * (AES-256-GCM) puis enregistre les webhooks. Redirige vers l'onboarding avec
 * un statut explicite — jamais de faux « connecté » si une étape échoue.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (code: string, extra?: Record<string, string>) => {
    const url = new URL(`/onboarding?step=1&error=${code}`, req.nextUrl.origin);
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  if (!isDatabaseConfigured() || !isManualConnectAvailable()) return fail("not_configured");

  const creds = await resolveOAuthCredentials();
  if (!creds) return fail("oauth_app_missing");

  // 1. Authenticité de la requête (HMAC calculé sur la query string, signé
  // avec le Client Secret de l'app Dev Dashboard / Partner)
  if (!verifyOAuthHmac(params, creds.clientSecret)) {
    console.warn("[oauth] HMAC de callback invalide");
    return fail("invalid_hmac");
  }

  // 2. Anti-CSRF : le state est vérifié EN BASE (présent, non expiré, non
  // utilisé), puis marqué comme consommé. Erreur précise selon la cause.
  const state = params.get("state") ?? "";
  if (!state) return fail("state_missing");
  const stateResult = await consumeOAuthState(hashOAuthState(state));
  if (stateResult.status !== "ok") {
    const code =
      stateResult.status === "absent"
        ? "state_db_absent"
        : stateResult.status === "expired"
          ? "state_expired"
          : "state_used";
    console.warn(`[oauth] State refusé : ${stateResult.status}`);
    return fail(code);
  }

  // Comparaison boutique attendue (depuis oauth_states) vs reçue (callback Shopify).
  const rawCallbackShop = params.get("shop") ?? "";
  const normalizedCallbackShop = normalizeShopDomain(rawCallbackShop);
  const expectedShopDomain = stateResult.shopDomain;
  const normalizedExpectedShop = normalizeShopDomain(expectedShopDomain) ?? expectedShopDomain;

  console.log(
    "[oauth/callback]",
    JSON.stringify({
      rawCallbackShop,
      normalizedCallbackShop,
      expectedShopDomain,
      normalizedExpectedShop,
      match: normalizedCallbackShop === normalizedExpectedShop,
    })
  );

  if (!normalizedCallbackShop || normalizedCallbackShop !== normalizedExpectedShop) {
    return fail("shop_mismatch", {
      shopExpected: normalizedExpectedShop || "(vide)",
      shopReceived: normalizedCallbackShop || rawCallbackShop || "(vide)",
    });
  }
  const shopDomain = normalizedCallbackShop;

  const code = params.get("code");
  if (!code) return fail("missing_code");

  try {
    // 3. Échange code → access token
    const { accessToken, scopes } = await exchangeCodeForToken(shopDomain, code, creds);

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

    // 6. Webhooks (orders, refunds, app/uninstalled) — callbacks sur l'URL de l'app
    const webhookResult = await registerWebhooks(shopDomain, accessToken, creds.appUrl);
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

    // Retour vers l'origine d'où l'autorisation a été lancée si disponible
    // (cohérence de domaine), sinon l'origine du callback.
    const base = stateResult.returnTo || req.nextUrl.origin;
    return NextResponse.redirect(
      new URL(`/onboarding?step=3&connected=1&shop=${encodeURIComponent(shopDomain)}`, base)
    );
  } catch (err) {
    console.error("[oauth] Échec de connexion :", err instanceof Error ? err.message : err);
    return fail("token_exchange_failed");
  }
}
