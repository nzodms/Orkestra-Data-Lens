import { NextResponse } from "next/server";
import { getDataset } from "@/data/dataset";

/**
 * Synchronisation initiale / incrémentale avec Shopify.
 *
 * TODO(prod) :
 *  1. Charger le token de la boutique authentifiée.
 *  2. Paginer GET /admin/api/2025-01/orders.json (updated_at_min = dernier sync)
 *     + produits + clients + remboursements.
 *  3. Upserter en base (Supabase/Prisma), puis relancer la réconciliation
 *     (lib/reconciliation.ts) sur la fenêtre impactée.
 *  4. Journaliser la progression pour l'UI d'onboarding.
 */
export async function POST() {
  const dataset = getDataset();

  return NextResponse.json({
    mode: "demo",
    syncedAt: new Date().toISOString(),
    counts: {
      products: dataset.products.length,
      sessions: dataset.sessions.length,
      orders: dataset.orders.length,
      anomalies: dataset.anomalies.length,
    },
  });
}
