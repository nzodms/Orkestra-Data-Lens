import { ShieldQuestion } from "lucide-react";
import { AnomalyCard } from "@/components/domain/AnomalyCard";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { getDataset } from "@/data/dataset";
import { formatEUR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function AnomaliesPage() {
  const dataset = getDataset();
  const anomalies = dataset.anomalies;
  const totalSessions = anomalies.reduce((a, b) => a + b.affectedSessions, 0);
  const totalRevenue = anomalies.reduce((a, b) => a + (b.affectedRevenue ?? 0), 0);
  const highCount = anomalies.filter((a) => a.severity === "high" || a.severity === "critical").length;

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <ShieldQuestion size={18} />
        </span>
        <div>
          <h2 className="text-[14.5px] font-semibold tracking-tight">
            Les incohérences sont affichées, pas cachées
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-soft">
            Chaque écart entre les événements pixel, les parcours reconstruits et les commandes Shopify est listé
            ici avec sa cause probable et l&apos;action recommandée. Une anomalie expliquée n&apos;est pas un
            problème : c&apos;est une donnée fiable de plus.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5 md:gap-3">
        <Stat label="Anomalies actives" value={anomalies.length} tone="warn" />
        <Stat label="Sévérité élevée" value={highCount} tone={highCount > 0 ? "critical" : "positive"} />
        <Stat label="CA concerné" value={formatEUR(Math.round(totalRevenue))} sub={`${totalSessions} sessions touchées`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {anomalies.map((anomaly) => (
          <AnomalyCard key={anomaly.id} anomaly={anomaly} />
        ))}
      </div>
    </div>
  );
}
