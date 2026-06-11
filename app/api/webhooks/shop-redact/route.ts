import { NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

/**
 * Webhook RGPD `shop/redact` : envoyé 48 h après la désinstallation.
 * Supprime toutes les données de la boutique (cascade sur toutes les tables).
 */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop }) => {
    if (!shop) return;
    await query("delete from shops where id = $1", [shop.id]);
    console.log(`[gdpr] shop/redact appliqué : données de ${shop.shopify_domain} supprimées`);
  });
}
