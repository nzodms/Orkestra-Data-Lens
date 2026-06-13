import { NextRequest, NextResponse } from "next/server";
import { createSignedState } from "@/lib/server/crypto";
import { isDatabaseConfigured, isManualConnectAvailable } from "@/lib/server/env";
import { resolveOAuthCredentials } from "@/lib/server/repo";
import { buildAuthorizeUrl, normalizeShopDomain } from "@/lib/server/shopify";

/**
 * Point d'entrée OAuth Shopify.
 * GET /api/shopify/auth?shop=ma-boutique.myshopify.com
 *
 * Les identifiants OAuth proviennent soit de la config « Dev Dashboard »
 * saisie dans l'interface (base, chiffrée), soit des variables
 * d'environnement de l'app Partner historique.
 *
 * Génère un state anti-CSRF signé (porté par un cookie HttpOnly) puis
 * redirige vers la page d'autorisation Shopify.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("shop") ?? "";
  const shopDomain = normalizeShopDomain(raw);

  if (!shopDomain) {
    return NextResponse.redirect(
      new URL(`/onboarding?step=1&error=invalid_shop`, req.nextUrl.origin)
    );
  }

  if (!isDatabaseConfigured() || !isManualConnectAvailable()) {
    return NextResponse.redirect(
      new URL(`/onboarding?step=1&error=not_configured&missing=DATABASE_URL,ENCRYPTION_SECRET`, req.nextUrl.origin)
    );
  }

  const creds = await resolveOAuthCredentials();
  if (!creds) {
    return NextResponse.redirect(
      new URL(`/onboarding?step=1&error=oauth_app_missing`, req.nextUrl.origin)
    );
  }

  const state = createSignedState(shopDomain);
  const response = NextResponse.redirect(buildAuthorizeUrl(shopDomain, state, creds));
  response.cookies.set("orkestra_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
