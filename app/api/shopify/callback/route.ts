import { NextRequest, NextResponse } from "next/server";

/**
 * Callback OAuth Shopify.
 *
 * TODO(prod) :
 *  1. Vérifier le HMAC de la requête avec SHOPIFY_API_SECRET.
 *  2. Vérifier le `state` anti-CSRF.
 *  3. Échanger le `code` contre un access token :
 *     POST https://{shop}/admin/oauth/access_token
 *  4. Persister le token chiffré (table `shops`), créer les webhooks
 *     (orders/create, orders/paid, refunds/create) et installer le Web Pixel
 *     via l'API GraphQL `webPixelCreate`.
 *  5. Rediriger vers /onboarding?step=sync.
 */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  return NextResponse.json({
    mode: "demo",
    message: "Callback OAuth non actif en mode démo.",
    receivedParams: Object.keys(params),
  });
}
