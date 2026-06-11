import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { FunnelMetrics, VerifiedFunnelMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * Comparaison chiffres Shopify bruts vs chiffres vérifiés Data Lens,
 * avec l'écart expliqué ligne par ligne.
 */
export function ComparisonTable({
  raw,
  verified,
}: {
  raw: FunnelMetrics;
  verified: VerifiedFunnelMetrics;
}) {
  const rows = [
    {
      label: "Sessions",
      shopify: formatNumber(raw.sessions),
      lens: formatNumber(verified.sessions),
      gap: null,
    },
    {
      label: "Ajouts panier",
      shopify: formatNumber(raw.addToCarts),
      lens: formatNumber(verified.addToCarts),
      gap: raw.addToCarts === verified.addToCarts ? null : `${verified.addToCarts - raw.addToCarts}`,
    },
    {
      label: "Checkouts commencés",
      shopify: formatNumber(raw.checkoutsStarted),
      lens:
        verified.outOfCohortCheckouts > 0
          ? `${formatNumber(verified.checkoutsStarted)} cohorte + ${verified.outOfCohortCheckouts} repris`
          : formatNumber(verified.checkoutsStarted),
      gap: verified.outOfCohortCheckouts > 0 ? `+${verified.outOfCohortCheckouts} hors cohorte` : null,
    },
    {
      label: "Paiements atteints",
      shopify: formatNumber(raw.paymentReached),
      lens:
        verified.outOfCohortPayments > 0
          ? `${formatNumber(verified.paymentReached)} cohorte + ${verified.outOfCohortPayments} hors période`
          : formatNumber(verified.paymentReached),
      gap: verified.outOfCohortPayments > 0 ? `+${verified.outOfCohortPayments} hors cohorte` : null,
    },
    {
      label: "Commandes",
      shopify: formatNumber(raw.ordersCompleted),
      lens: `${formatNumber(verified.confirmedOrders)} confirmée${verified.confirmedOrders > 1 ? "s" : ""}`,
      gap:
        verified.confirmedOrders !== raw.ordersCompleted
          ? `${verified.confirmedOrders - raw.ordersCompleted > 0 ? "+" : ""}${verified.confirmedOrders - raw.ordersCompleted} hors pixel`
          : null,
    },
  ];

  return (
    <Card>
      <CardTitle sub="Shopify agrège les événements dans la période sélectionnée. Data Lens reconstruit les parcours session par session pour expliquer les écarts.">
        Shopify vs Data Lens
      </CardTitle>
      <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
        <table className="w-full min-w-[480px] text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-200/70 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-3 font-medium">Métrique</th>
              <th className="py-2 pr-3 font-medium">Shopify brut</th>
              <th className="py-2 pr-3 font-medium">Data Lens vérifié</th>
              <th className="py-2 font-medium">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium">{r.label}</td>
                <td className="num py-2.5 pr-3">{r.shopify}</td>
                <td className="num py-2.5 pr-3">{r.lens}</td>
                <td className="py-2.5">
                  {r.gap ? <Badge tone="orange">{r.gap}</Badge> : <Badge tone="green">0</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
