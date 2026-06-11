import { Lightbulb, Link2Off } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getDataset } from "@/data/dataset";
import { computeSourceStats } from "@/lib/analytics";
import { parsePeriod, PERIOD_LABELS } from "@/lib/funnel";
import { formatEUR, formatNumber, formatPct } from "@/lib/utils";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const dataset = getDataset();
  const stats = computeSourceStats(dataset, period);
  const insights = stats.filter((s) => s.insight);
  const missingUtm = dataset.anomalies.find((a) => a.type === "missing_utm");
  const best = [...stats].filter((s) => s.orders > 0).sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle sub={`Qualité réelle du trafic par canal sur ${PERIOD_LABELS[period].toLowerCase()} — pas seulement « quelle pub a vendu ».`}>
          Trafic par source
        </CardTitle>
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
          <table className="w-full min-w-[820px] text-[12px]">
            <thead>
              <tr className="border-b border-gray-200/70 text-left text-[10.5px] uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 text-right font-medium">Sessions</th>
                <th className="py-2 pr-3 text-right font-medium">Vues produit</th>
                <th className="py-2 pr-3 text-right font-medium">Ajouts</th>
                <th className="py-2 pr-3 text-right font-medium">Checkouts</th>
                <th className="py-2 pr-3 text-right font-medium">Achats</th>
                <th className="py-2 pr-3 text-right font-medium">CA</th>
                <th className="py-2 pr-3 text-right font-medium">Panier moyen</th>
                <th className="py-2 pr-3 text-right font-medium">Vue→Panier</th>
                <th className="py-2 font-medium">Qualité</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.key} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">{s.label}</span>
                    {s.key === "unknown" && (
                      <Badge tone="orange" className="ml-1.5">
                        UTM manquants
                      </Badge>
                    )}
                  </td>
                  <td className="num py-2.5 pr-3 text-right">{formatNumber(s.sessions)}</td>
                  <td className="num py-2.5 pr-3 text-right">{formatNumber(s.productViews)}</td>
                  <td className="num py-2.5 pr-3 text-right">{s.addToCarts}</td>
                  <td className="num py-2.5 pr-3 text-right">{s.checkouts}</td>
                  <td className="num py-2.5 pr-3 text-right font-semibold">{s.orders}</td>
                  <td className="num py-2.5 pr-3 text-right font-semibold">{formatEUR(s.revenue)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-soft">
                    {s.avgOrderValue > 0 ? formatEUR(s.avgOrderValue) : "—"}
                  </td>
                  <td className="num py-2.5 pr-3 text-right">{formatPct(s.viewToCartRate)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <ProgressBar
                        value={s.qualityScore}
                        color={
                          s.qualityScore >= 60
                            ? "var(--color-positive)"
                            : s.qualityScore >= 35
                              ? "var(--color-warn)"
                              : "var(--color-critical)"
                        }
                        height={5}
                        className="w-16"
                      />
                      <span className="num text-[10.5px] font-semibold">{s.qualityScore}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((s) => (
          <Card key={s.key} className="flex gap-3">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <div className="text-[12.5px] font-semibold">{s.label}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{s.insight}</p>
            </div>
          </Card>
        ))}
        {best && (
          <Card className="flex gap-3 border-positive/15 bg-positive-soft/30">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-positive" />
            <div>
              <div className="text-[12.5px] font-semibold">Source la plus rentable</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                {best.label} : {formatEUR(best.revenue)} de CA confirmé ({best.orders} commande
                {best.orders > 1 ? "s" : ""}, panier moyen {formatEUR(best.avgOrderValue)}).
              </p>
            </div>
          </Card>
        )}
        {missingUtm && (
          <Card className="flex gap-3 border-warn/15 bg-warn-soft/30">
            <Link2Off size={16} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <div className="text-[12.5px] font-semibold">Anomalies UTM</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{missingUtm.description}</p>
              <p className="mt-1 text-[11.5px] font-medium text-warn">{missingUtm.recommendedAction}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
