import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook Shopify `orders/create` et `orders/paid`.
 *
 * TODO(prod) :
 *  1. Vérifier l'en-tête X-Shopify-Hmac-Sha256 avec SHOPIFY_API_SECRET.
 *  2. Dédupliquer via X-Shopify-Webhook-Id.
 *  3. Upserter la commande, tenter la réconciliation immédiate :
 *     cart_token / checkout_token → session pixel → statut "confirmed".
 *  4. Si aucune session trouvée après 15 min → anomalie `order_without_session`.
 *  5. Répondre 200 en < 5 s (traitement lourd en file d'attente).
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);

  return NextResponse.json({
    mode: "demo",
    received: payload != null,
    topic: req.headers.get("x-shopify-topic") ?? "orders/create",
  });
}
