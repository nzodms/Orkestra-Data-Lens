import { NextRequest, NextResponse } from "next/server";
import { createSignedState } from "@/lib/server/crypto";
import { configIssues, isDatabaseConfigured, isOAuthConfigured } from "@/lib/server/env";
import { buildAuthorizeUrl, normalizeShopDomain } from "@/lib/server/shopify";

/**
 * Point d'entrée OAuth Shopify.
 * GET /api/shopify/auth?shop=ma-boutique.myshopify.com
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

  if (!isOAuthConfigured() || !isDatabaseConfigured()) {
    const missing = configIssues().map((i) => i.key).join(",");
    return NextResponse.redirect(
      new URL(`/onboarding?step=1&error=not_configured&missing=${encodeURIComponent(missing)}`, req.nextUrl.origin)
    );
  }

  const state = createSignedState(shopDomain);
  const response = NextResponse.redirect(buildAuthorizeUrl(shopDomain, state));
  response.cookies.set("orkestra_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
