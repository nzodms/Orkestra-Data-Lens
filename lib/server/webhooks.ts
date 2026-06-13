import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "./env";
import { verifyWebhookHmac } from "./shopify";
import {
  getShopByDomain,
  markWebhookDelivery,
  recordWebhookDelivery,
  resolveOAuthCredentials,
  type ShopRow,
} from "./repo";

/**
 * Pipeline commun à tous les webhooks Shopify :
 *  1. lire le raw body (obligatoire pour le HMAC) ;
 *  2. vérifier X-Shopify-Hmac-Sha256 ;
 *  3. dédupliquer via X-Shopify-Webhook-Id ;
 *  4. répondre 200 rapidement, le traitement métier étant délégué au handler.
 *
 * Shopify réessaie en cas de non-200 : on ne renvoie 401 que sur HMAC
 * invalide (requête non authentique).
 */
export async function handleShopifyWebhook(
  req: NextRequest,
  handler: (ctx: { shop: ShopRow | null; topic: string; payload: unknown }) => Promise<void>
): Promise<NextResponse> {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic") ?? "unknown";
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const deliveryId = req.headers.get("x-shopify-webhook-id") ?? `no-id-${Date.now()}`;

  // Le secret de signature des webhooks est le Client Secret de l'app —
  // config Dev Dashboard (base) en priorité, sinon variable d'environnement.
  const creds = await resolveOAuthCredentials().catch(() => null);
  if (!verifyWebhookHmac(rawBody, hmac, creds?.clientSecret ?? undefined)) {
    console.warn(`[webhook] HMAC invalide (topic=${topic}, shop=${shopDomain ?? "?"})`);
    return NextResponse.json({ error: "HMAC invalide" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    // HMAC valide mais pas de base : on accuse réception pour éviter les
    // retries en boucle, en le journalisant côté serveur.
    console.warn(`[webhook] ${topic} reçu mais DATABASE_URL non configuré — ignoré`);
    return NextResponse.json({ received: true, stored: false });
  }

  try {
    const shop = shopDomain ? await getShopByDomain(shopDomain) : null;
    const dedup = await recordWebhookDelivery({
      deliveryId,
      topic,
      shopDomain,
      shopId: shop?.id ?? null,
      payload,
    });
    if (dedup === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      await handler({ shop, topic, payload });
      await markWebhookDelivery(deliveryId, "processed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "erreur de traitement";
      console.error(`[webhook] Échec du traitement ${topic} :`, message);
      await markWebhookDelivery(deliveryId, "error", message);
      // 200 quand même : la livraison est journalisée, on retraitera côté app.
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhook] Erreur base sur ${topic} :`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
