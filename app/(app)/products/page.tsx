import { Lightbulb } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LiveEmptyState } from "@/components/domain/LiveEmptyState";
import { getActiveDataset } from "@/lib/server/datasource";
import {
  computeProductStats,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
  type ProductStats,
} from "@/lib/analytics";
import { parsePeriod, PERIOD_LABELS } from "@/lib/funnel";
import { formatEUR, formatNumber, formatPct } from "@/lib/utils";

const CATEGORY_TONES: Record<ProductCategory, BadgeTone> = {
  scaler: "green",
  ameliorer: "orange",
  bloque_checkout: "red",
  suspect: "violet",
  couper: "neutral",
  correct: "blue",
};

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

  const categories: ProductCategory[] = ["scaler", "ameliorer", "bloque_checkout", "suspect", "couper"];
  const grouped = categories
    .map((c) => ({ category: c, items: stats.filter((s) => s.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Tableau principal */}
      <Card>
        <CardTitle sub={`Métriques calculées sur ${PERIOD_LABELS[period].toLowerCase()} à partir des parcours reconstruits et des commandes Shopify.`}>
          Performance par produit
        </CardTitle>
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
          <table className="w-full min-w-[860px] text-[12px]">
            <thead>
              <tr className="border-b border-gray-200/70 text-left text-[10.5px] uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-medium">Produit</th>
                <th className="py-2 pr-3 text-right font-medium">Vues</th>
                <th className="py-2 pr-3 text-right font-medium">Ajouts</th>
                <th className="py-2 pr-3 text-right font-medium">Vue→Panier</th>
                <th className="py-2 pr-3 text-right font-medium">Checkouts</th>
                <th className="py-2 pr-3 text-right font-medium">Achats</th>
                <th className="py-2 pr-3 text-right font-medium">CA</th>
                <th className="py-2 pr-3 text-right font-medium">Marge est.</th>
                <th className="py-2 pr-3 text-right font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Scores</th>
                <th className="py-2 font-medium">Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.product.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 text-[10px] font-bold text-ink-soft">
                        {s.product.title
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      <div>
                        <div className="font-semibold leading-tight">{s.product.title}</div>
                        <div className="num text-[10.5px] text-ink-soft">{formatEUR(s.product.priceMin)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num py-2.5 pr-3 text-right">{formatNumber(s.views)}</td>
                  <td className="num py-2.5 pr-3 text-right">{s.addToCarts}</td>
                  <td className="num py-2.5 pr-3 text-right">{formatPct(s.viewToCartRate)}</td>
                  <td className="num py-2.5 pr-3 text-right">{s.checkouts}</td>
                  <td className="num py-2.5 pr-3 text-right font-semibold">{s.purchases}</td>
                  <td className="num py-2.5 pr-3 text-right font-semibold">{formatEUR(s.revenue)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-soft">{formatEUR(s.estimatedMargin)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-soft">{s.product.stock ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <ScoreCell label="Conv." value={s.conversionScore} />
                    <ScoreCell label="Frict." value={s.frictionScore} inverted />
                    <ScoreCell label="Data" value={s.dataReliability} />
                  </td>
                  <td className="py-2.5">
                    <Badge tone={CATEGORY_TONES[s.category]}>{PRODUCT_CATEGORY_LABELS[s.category]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Insights produit */}
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((s) => (
            <Card key={s.product.id} className="flex gap-3">
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
                <div key={s.product.id} className="rounded-xl border border-gray-200/70 bg-gray-50/60 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">{s.product.title}</span>
                    <span className="num text-[11.5px] text-ink-soft">
                      {s.views} vues · {s.purchases} achat{s.purchases > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{s.recommendedAction}</p>
                  <MiniFunnel stats={s} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ScoreCell({ label, value, inverted }: { label: string; value: number; inverted?: boolean }) {
  const good = inverted ? value < 40 : value >= 60;
  const mid = inverted ? value < 70 : value >= 35;
  const color = good ? "var(--color-positive)" : mid ? "var(--color-warn)" : "var(--color-critical)";
  return (
    <div className="mb-1 flex items-center gap-1.5 last:mb-0">
      <span className="w-8 text-[9.5px] uppercase tracking-wide text-ink-soft">{label}</span>
      <ProgressBar value={value} color={color} height={4} className="w-14" />
      <span className="num w-6 text-right text-[10px] font-semibold">{value}</span>
    </div>
  );
}

function MiniFunnel({ stats }: { stats: ProductStats }) {
  const steps = [
    { label: "Vues", value: stats.views },
    { label: "Paniers", value: stats.addToCarts },
    { label: "Checkouts", value: stats.checkouts },
    { label: "Achats", value: stats.purchases },
  ];
  const base = steps[0].value || 1;
  return (
    <div className="mt-2 flex items-end gap-1">
      {steps.map((s) => (
        <div key={s.label} className="flex-1">
          <div className="flex h-10 items-end overflow-hidden rounded-md bg-gray-100">
            <div
              className="w-full rounded-md bg-brand/70"
              style={{ height: `${Math.max(s.value > 0 ? 8 : 2, (s.value / base) * 100)}%` }}
            />
          </div>
          <div className="mt-0.5 text-center text-[9px] text-ink-soft">
            {s.label} <span className="num font-semibold text-ink">{s.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
