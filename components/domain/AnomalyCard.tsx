import { AlertTriangle, Lightbulb, Wrench } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { severityLabel } from "@/lib/scoring";
import type { Anomaly } from "@/lib/types";
import { formatEUR } from "@/lib/utils";

const SEVERITY_TONES: Record<Anomaly["severity"], BadgeTone> = {
  low: "neutral",
  medium: "orange",
  high: "red",
  critical: "red",
};

export function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle
          size={16}
          className={anomaly.severity === "low" ? "text-ink-soft" : anomaly.severity === "medium" ? "text-warn" : "text-critical"}
        />
        <h3 className="flex-1 text-[13.5px] font-semibold">{anomaly.title}</h3>
        <Badge tone={SEVERITY_TONES[anomaly.severity]}>Sévérité {severityLabel(anomaly.severity).toLowerCase()}</Badge>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{anomaly.description}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
        <span>
          <span className="text-ink-soft">Sessions concernées : </span>
          <span className="num font-semibold">{anomaly.affectedSessions}</span>
        </span>
        {anomaly.affectedRevenue != null && anomaly.affectedRevenue > 0 && (
          <span>
            <span className="text-ink-soft">CA concerné : </span>
            <span className="num font-semibold">{formatEUR(anomaly.affectedRevenue)}</span>
          </span>
        )}
      </div>

      {(anomaly.probableCause || anomaly.recommendedAction) && (
        <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">
          {anomaly.probableCause && (
            <div className="flex gap-2 text-[12px] leading-relaxed">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-warn" />
              <span>
                <span className="font-semibold">Cause probable : </span>
                <span className="text-ink-soft">{anomaly.probableCause}</span>
              </span>
            </div>
          )}
          {anomaly.recommendedAction && (
            <div className="flex gap-2 text-[12px] leading-relaxed">
              <Wrench size={14} className="mt-0.5 shrink-0 text-brand" />
              <span>
                <span className="font-semibold">Action recommandée : </span>
                <span className="text-ink-soft">{anomaly.recommendedAction}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
