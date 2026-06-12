import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { LiveEmptyState } from "@/components/domain/LiveEmptyState";
import { CATEGORY_TONES, MiniFunnel, ProductsTable } from "@/components/domain/ProductsTable";
import { getActiveDataset } from "@/lib/server/datasource";
import { getDeskContext } from "@/lib/server/orderdesk";
import {
  computeProductStats,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/analytics";
import { computeProductSourcing, type ProductSourcing } from "@/lib/orderdesk/productSourcing";
import { parsePeriod, PERIOD_LABELS } from "@/lib/funnel";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const { dataset, mode, status, liveEmpty } = await getActiveDataset();
  if (mode === "live" && liveEmpty && dataset.products.length === 0) {
    return <LiveEmptyState pixelInstalled={status.pixelStatus === "installed"} />;
  }
  const stats = computeProductStats(dataset, period);
  const insights = stats.filter((s) => s.insight);

  // Sourcing : croise les produits Data Lens avec les fournisseurs Order Desk
  const { data: desk } = await getDeskContext();
  const sourcing: Record<string, ProductSourcing> = {};
  for (const s of stats) {
    sourcing[s.product.id] = computeProductSourcing(s.product.id, s.product.priceMin, desk);
  }

  const categories: ProductCategory[] = ["scaler", "ameliorer", "bloque_checkout", "suspect", "couper"];
  const grouped = categories
    .map((c) => ({ category: c, items: stats.filter((s) => s.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Tableau principal (drawer fiche produit au clic) */}
      <Card>
        <CardTitle sub={`Métriques calculées sur ${PERIOD_LABELS[period].toLowerCase()} à partir des parcours reconstruits et des commandes Shopify. Cliquez sur un produit pour ouvrir sa fiche.`}>
          Performance par produit
        </CardTitle>
        <div className="-mx-4 px-4 md:-mx-5 md:px-5">
          <ProductsTable
            stats={stats}
            sourcing={JSON.parse(JSON.stringify(sourcing))}
            suppliers={JSON.parse(JSON.stringify(desk.suppliers))}
          />
        </div>
      </Card>

      {/* Insights produit */}
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((s) => (
            <Card key={s.product.id} className="card-hover flex gap-3">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
              <div>
                <div className="text-[12.5px] font-semibold">{s.product.title}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{s.insight}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Catégories automatiques */}
      <div className="grid gap-3 md:grid-cols-2">
        {grouped.map((g) => (
          <Card key={g.category}>
            <div className="mb-2.5 flex items-center justify-between">
              <Badge tone={CATEGORY_TONES[g.category]}>{PRODUCT_CATEGORY_LABELS[g.category]}</Badge>
              <span className="num text-[11px] text-ink-soft">
                {g.items.length} produit{g.items.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {g.items.map((s) => (
                <div key={s.product.id} className="inset-panel p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">{s.product.title}</span>
                    <span className="num text-[11.5px] text-ink-soft">
                      {s.views} vues · {s.purchases} achat{s.purchases > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{s.recommendedAction}</p>
                  <div className="mt-2">
                    <MiniFunnel stats={s} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
