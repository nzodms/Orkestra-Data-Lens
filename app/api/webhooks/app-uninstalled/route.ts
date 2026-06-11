import { NextRequest } from "next/server";
import { markShopUninstalled } from "@/lib/server/repo";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

/**
 * Webhook `app/uninstalled` : la boutique repasse en « déconnectée » et le
 * token (devenu invalide) est supprimé. Les données restent en base mais
 * l'interface repasse en mode démo tant qu'aucune boutique n'est connectée.
 */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop }) => {
    if (!shop) return;
    await markShopUninstalled(shop.shopify_domain);
    console.log(`[webhook] App désinstallée : ${shop.shopify_domain}`);
  });
}
