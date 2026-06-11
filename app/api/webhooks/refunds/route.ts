import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook Shopify `refunds/create`.
 *
 * TODO(prod) :
 *  1. Vérifier le HMAC (X-Shopify-Hmac-Sha256).
 *  2. Rattacher le remboursement à la commande et au produit concernés.
 *  3. Mettre à jour les métriques produit (taux de remboursement, marge).
 *  4. Émettre l'événement interne `refund_created` dans la timeline.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);

  return NextResponse.json({ mode: "demo", received: payload != null });
}
