import { NextRequest, NextResponse } from "next/server";
import { hashOAuthState, randomOAuthState } from "@/lib/server/crypto";
import { isDatabaseConfigured, isManualConnectAvailable } from "@/lib/server/env";
import { createOAuthState, purgeExpiredOAuthStates, resolveOAuthCredentials } from "@/lib/server/repo";
import { buildAuthorizeUrl, normalizeShopDomain } from "@/lib/server/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Point d'entrée OAuth Shopify.
 * GET /api/shopify/auth?shop=ma-boutique.myshopify.com
 *
 * State anti-CSRF stocké EN BASE (table oauth_states) — pas en cookie ni en
 * mémoire : robuste sur Vercel serverless (le callback peut être servi par une
 * autre instance, sur un autre domaine). On envoie le state en clair à Shopify
 * et on ne persiste que son hash SHA-256.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("shop") ?? "";
  const shopDomain = normalizeShopDomain(raw);

  if (!shopDomain) {
    return NextResponse.redirect(new URL(`/onboarding?step=1&error=invalid_shop`, req.nextUrl.origin));
  }

  if (!isDatabaseConfigured() || !isManualConnectAvailable()) {
    return NextResponse.redirect(
      new URL(`/onboarding?step=1&error=not_configured&missing=DATABASE_URL,ENCRYPTION_SECRET`, req.nextUrl.origin)
    );
  }

  const creds = await resolveOAuthCredentials();
  if (!creds) {
    return NextResponse.redirect(new URL(`/onboarding?step=1&error=oauth_app_missing`, req.nextUrl.origin));
  }

  const state = randomOAuthState();
  try {
    await purgeExpiredOAuthStates();
    await createOAuthState({
      stateHash: hashOAuthState(state),
      shopDomain,
      returnTo: req.nextUrl.origin,
      ttlMinutes: 10,
    });
  } catch (err) {
    console.error("[oauth] Stockage du state impossible :", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL(`/onboarding?step=1&error=state_store_failed`, req.nextUrl.origin));
  }

  return NextResponse.redirect(buildAuthorizeUrl(shopDomain, state, creds));
}
