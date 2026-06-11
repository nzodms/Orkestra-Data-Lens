import { NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

/**
 * Webhook RGPD `customers/redact` : suppression des données du client.
 * On efface la fiche client (email masqué inclus) et on anonymise les
 * références dans les événements de tracking.
 */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop, payload }) => {
    if (!shop) return;
    const p = payload as { customer?: { id?: number | string } } | null;
    const customerId = p?.customer?.id != null ? String(p.customer.id) : null;
    if (!customerId) return;

    await query("delete from customers where shop_id = $1 and shopify_customer_id = $2", [shop.id, customerId]);
    await query("update tracking_events set customer_id = null where shop_id = $1 and customer_id = $2", [
      shop.id,
      customerId,
    ]);
    console.log(`[gdpr] customers/redact appliqué (shop=${shop.shopify_domain}, customer=${customerId})`);
  });
}
