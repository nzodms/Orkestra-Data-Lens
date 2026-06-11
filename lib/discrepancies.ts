import type { Dataset, Discrepancy, Period } from "./types";
import { computeVerifiedFunnel, ordersInPeriod, sessionsInPeriod } from "./funnel";
import { dayOffsetOf } from "./utils";

/**
 * Écarts détectés entre le funnel brut (façon Shopify) et les parcours
 * reconstruits. Seuls les écarts non nuls sont retournés.
 */
export function computeDiscrepancies(dataset: Dataset, period: Period): Discrepancy[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);
  const verified = computeVerifiedFunnel(sessions, dataset.orders, period);

  const out: Discrepancy[] = [];

  if (verified.outOfCohortCheckouts > 0) {
    out.push({
      id: "d_checkout",
      label: "Checkout sans ajout panier dans la période",
      count: verified.outOfCohortCheckouts,
      tone: "warning",
      explanation: "Checkouts repris depuis un panier créé avant la période ou sur un autre appareil.",
    });
  }
  if (verified.outOfCohortPayments > 0) {
    out.push({
      id: "d_payment",
      label: "Paiement atteint hors cohorte",
      count: verified.outOfCohortPayments,
      tone: "warning",
      explanation: "Paiements comptés par Shopify dans la période, mais issus de parcours commencés avant.",
    });
  }

  const ordersNoSource = orders.filter((o) => !o.source).length;
  if (ordersNoSource > 0) {
    out.push({
      id: "d_order_source",
      label: "Commande sans source marketing",
      count: ordersNoSource,
      tone: "warning",
      explanation: "Commandes confirmées dont la session n'a ni UTM ni référent attribuable.",
    });
  }

  const orphanOrders = orders.filter((o) => !o.sessionId).length;
  if (orphanOrders > 0) {
    out.push({
      id: "d_orphan",
      label: "Achat confirmé mais événement pixel manquant",
      count: orphanOrders,
      tone: "critical",
      explanation: "Commandes Shopify sans aucune session de tracking (consentement refusé, bloqueur, POS).",
    });
  }

  if (verified.missingAddToCartEvents > 0) {
    out.push({
      id: "d_missing_atc",
      label: "Ajout panier non rattachable",
      count: verified.missingAddToCartEvents,
      tone: "critical",
      explanation: "Paniers dont l'événement add_to_cart n'a jamais été observé, même sur les jours précédents.",
    });
  }

  const outOfPeriodCarts = sessions.filter((s) =>
    s.events.some((e) => {
      const created = e.metadata?.cartCreatedAt as string | undefined;
      return created && dayOffsetOf(created) > dayOffsetOf(s.startedAt);
    })
  ).length;
  if (outOfPeriodCarts > 0 && period !== "7d") {
    out.push({
      id: "d_out_of_period",
      label: "Événement hors période",
      count: outOfPeriodCarts,
      tone: "info",
      explanation: "Sessions qui réutilisent un panier créé avant la période sélectionnée.",
    });
  }

  const incompleteSessions = sessions.filter((s) => s.status === "incomplete").length;
  if (incompleteSessions > 0) {
    out.push({
      id: "d_incomplete",
      label: "Session incomplète",
      count: incompleteSessions,
      tone: "warning",
      explanation: "Parcours dont une étape attendue manque : impossible de garantir l'ordre complet.",
    });
  }

  return out;
}
