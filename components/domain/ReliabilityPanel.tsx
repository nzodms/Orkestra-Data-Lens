import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { DataReliabilityScore } from "@/lib/types";

const colorFor = (v: number) =>
  v >= 85 ? "var(--color-positive)" : v >= 65 ? "var(--color-warn)" : "var(--color-critical)";

export function ReliabilityPanel({
  score,
  anomalyCount,
  compact = false,
}: {
  score: DataReliabilityScore;
  anomalyCount: number;
  compact?: boolean;
}) {
  const details = [
    { label: "Événements captés", value: score.eventCoverage },
    { label: "Checkouts réconciliés", value: score.reconciliationRate },
    { label: "Commandes rattachées (7 j)", value: score.orderMatchRate },
    { label: "Sources attribuables", value: score.sourceTrackingQuality },
  ];

  return (
    <Card>
      <CardTitle sub={compact ? undefined : "Calculé à partir de la couverture des événements, de la réconciliation des parcours et des anomalies détectées."}>
        Fiabilité des données
      </CardTitle>
      <div className="flex items-center gap-5">
        <ScoreRing value={score.globalScore} size={compact ? 72 : 92} label="/100" />
        <div className="flex-1 space-y-2.5">
          {details.map((d) => (
            <div key={d.label}>
              <div className="mb-0.5 flex items-baseline justify-between">
                <span className="text-[11.5px] text-ink-soft">{d.label}</span>
                <span className="num text-[11.5px] font-semibold">{d.value}%</span>
              </div>
              <ProgressBar value={d.value} color={colorFor(d.value)} height={5} />
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-[11.5px] text-ink-soft">Anomalies détectées</span>
            <span className="num text-[11.5px] font-semibold text-warn">{anomalyCount}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
