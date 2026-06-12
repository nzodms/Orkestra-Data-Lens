import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/data/dataset";
import { isDatabaseConfigured } from "@/lib/server/env";
import { getConnectedShop } from "@/lib/server/repo";
import { runSync } from "@/lib/server/sync";

/**
 * POST /api/shopify/sync — synchronisation Shopify → base.
 * body optionnel : { rangeDays?: 30 | 90 }
 *
 * V1 : fenêtre 30 jours par défaut, 90 jours maximum.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    const demo = getDataset();
    return NextResponse.json({
      mode: "demo",
      message: "Aucune base configurée : données de démonstration uniquement.",
      counts: {
        products: demo.products.length,
        sessions: demo.sessions.length,
        orders: demo.orders.length,
      },
    });
  }

  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json(
      { mode: "demo", error: "Aucune boutique connectée. Lancez la connexion OAuth d'abord." },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { rangeDays?: number; scope?: string };
  const rangeDays = Math.min(90, Math.max(1, Number(body.rangeDays ?? 30)));
  const scope = body.scope === "products" || body.scope === "orders" ? body.scope : "all";

  const result = await runSync(shop, rangeDays, scope);
  return NextResponse.json(
    {
      mode: "live",
      shop: shop.shopify_domain,
      rangeDays,
      ...result,
    },
    { status: result.status === "success" ? 200 : 502 }
  );
}
