import { NextRequest } from "next/server";
import { upsertOrderFromPayload, type ShopifyOrderPayload } from "@/lib/server/repo";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

/**
 * Webhooks `orders/create`, `orders/paid`, `orders/updated`.
 * HMAC vérifié sur le raw body, déduplication par X-Shopify-Webhook-Id,
 * livraison journalisée dans webhook_deliveries.
 *
 * La commande Shopify est la source de vérité : son upsert permet ensuite au
 * moteur de réconciliation de confirmer les événements pixel correspondants
 * (cart_token / checkout_token / order_id).
 */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop, payload }) => {
    if (!shop) throw new Error("Boutique inconnue pour ce webhook");
    await upsertOrderFromPayload(shop.id, payload as ShopifyOrderPayload);
  });
}
