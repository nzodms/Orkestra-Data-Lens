import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/server/activity";
import { isDatabaseConfigured } from "@/lib/server/env";
import { disconnectShop, getConnectedShop } from "@/lib/server/repo";

/**
 * POST /api/shopify/disconnect — déconnexion explicite.
 * body : { deleteData?: boolean }
 * Le token est toujours supprimé ; les données synchronisées ne sont
 * supprimées que sur confirmation explicite (deleteData = true).
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Aucune base configurée." }, { status: 409 });
  }
  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Aucune boutique connectée." }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as { deleteData?: boolean };
  const deleteData = body.deleteData === true;

  await logActivity({
    entityType: "system",
    entityId: shop.id,
    action: "shop_disconnected",
    title: `Boutique déconnectée : ${shop.shopify_domain}`,
    description: deleteData ? "Token et données synchronisées supprimés." : "Token supprimé, données conservées.",
    actorType: "user",
  });
  await disconnectShop(shop.id, deleteData);
  console.log(`[disconnect] ${shop.shopify_domain} (deleteData=${deleteData})`);

  return NextResponse.json({ ok: true, deletedData: deleteData });
}
