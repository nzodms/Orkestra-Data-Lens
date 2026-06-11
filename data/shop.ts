import type { Shop } from "@/lib/types";
import { at } from "@/lib/utils";

/**
 * Boutique de démonstration.
 * En mode "demo", toutes les données sont simulées : l'interface l'indique
 * clairement. Une fois l'OAuth Shopify branché (/api/shopify/auth),
 * apiStatus passera à "connected" et pixelStatus à "installed".
 */
export const shop: Shop = {
  id: "shop_demo_01",
  shopifyDomain: "maison-lumiere-demo.myshopify.com",
  name: "Maison Lumière",
  currency: "EUR",
  timezone: "Europe/Paris",
  connectedAt: at(12, "09:14:00"),
  apiStatus: "demo",
  pixelStatus: "demo",
};
