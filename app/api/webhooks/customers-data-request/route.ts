import { NextRequest } from "next/server";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

/**
 * Webhook RGPD `customers/data_request` (obligatoire pour publier l'app).
 * Orkestra ne stocke que des emails masqués et des identifiants anonymes :
 * la demande est journalisée dans webhook_deliveries pour traitement manuel
 * sous 30 jours.
 */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop, payload }) => {
    const p = payload as { customer?: { id?: number } } | null;
    console.log(
      `[gdpr] customers/data_request reçu (shop=${shop?.shopify_domain ?? "?"}, customer=${p?.customer?.id ?? "?"})`
    );
  });
}
