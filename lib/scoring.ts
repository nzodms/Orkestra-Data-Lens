import type { Anomaly, DataReliabilityScore, Dataset, Period } from "./types";
import { classifySource } from "./events";
import { ordersInPeriod, sessionsInPeriod } from "./funnel";

const SEVERITY_PENALTY = { critical: 12, high: 8, medium: 5, low: 2 } as const;

/**
 * Score de fiabilité des données, calculé (et non inventé) à partir du
 * dataset : couverture des événements, réconciliation des checkouts,
 * rattachement des commandes, qualité des sources, anomalies.
 */
export function computeReliability(
  dataset: Dataset,
  period: Period
): DataReliabilityScore & { anomalyCount: number } {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);

  // Couverture : sessions sans événement incomplet/suspect
  const degraded = sessions.filter((s) =>
    s.events.some((e) => e.status === "incomplete" || e.status === "suspect")
  ).length;
  const eventCoverage = pct(sessions.length - degraded, sessions.length);

  // Réconciliation : checkouts dont le panier d'origine est identifié
  const checkouts = sessions.filter((s) => s.events.some((e) => e.eventName === "checkout_started"));
  const identified = checkouts.filter((s) =>
    s.events.some((e) => e.eventName === "checkout_started" && e.status !== "incomplete")
  );
  const reconciliationRate = pct(identified.length, checkouts.length);

  // Commandes Shopify rattachées à une session pixel (fenêtre 7 jours)
  const orders7d = ordersInPeriod(dataset.orders, "7d");
  const matched = orders7d.filter((o) => o.sessionId).length;
  const orderMatchRate = pct(matched, orders7d.length);
  void orders;

  // Qualité du tracking de source : sessions attribuables (hors direct/inconnu)
  const attributable = sessions.filter((s) => {
    const key = classifySource(s.source, s.medium);
    return key !== "unknown" && key !== "direct";
  }).length;
  const sourceTrackingQuality = pct(attributable, sessions.length);

  const anomalyPenalty = dataset.anomalies.reduce((acc, a) => acc + SEVERITY_PENALTY[a.severity], 0);
  const anomalyRate = Math.max(0, 100 - anomalyPenalty);

  const globalScore = Math.round(
    0.2 * eventCoverage +
      0.25 * reconciliationRate +
      0.15 * orderMatchRate +
      0.2 * sourceTrackingQuality +
      0.2 * anomalyRate
  );

  return {
    globalScore,
    eventCoverage,
    reconciliationRate,
    orderMatchRate,
    sourceTrackingQuality,
    anomalyRate,
    anomalyCount: dataset.anomalies.length,
  };
}

export function severityLabel(severity: Anomaly["severity"]): string {
  return { low: "Faible", medium: "Moyenne", high: "Élevée", critical: "Critique" }[severity];
}

function pct(num: number, den: number): number {
  if (den === 0) return 100;
  return Math.round((num / den) * 100);
}
