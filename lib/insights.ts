import type { Dataset, Insight, Period, PriorityAction } from "./types";
import { computeAbandonments, computeProductStats, computeSourceStats } from "./analytics";
import {
  computeRawFunnel,
  computeVerifiedFunnel,
  ordersInPeriod,
  PERIOD_LABELS,
  revenueOf,
  sessionsInPeriod,
} from "./funnel";
import { computeReliability } from "./scoring";
import { formatEUR, formatPct } from "./utils";

/**
 * Couche d'insights : commente uniquement les données calculées du dataset,
 * jamais de chiffres inventés. Chaque phrase est dérivée des métriques.
 */

const fmtRate = (n: number) => formatPct(Math.round(n * 100) / 100, 2);

export function generateDailySummary(dataset: Dataset, period: Period): string[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const raw = computeRawFunnel(sessions);
  const verified = computeVerifiedFunnel(sessions, dataset.orders, period);
  const periodLabel = PERIOD_LABELS[period].toLowerCase();

  const lines: string[] = [];
  lines.push(
    `${period === "today" ? "Aujourd'hui" : period === "yesterday" ? "Hier" : "Sur les 7 derniers jours"}, ${raw.sessions} visiteurs sont venus sur la boutique.`
  );
  lines.push(`${raw.productViews} ont vu au moins un produit.`);
  lines.push(`${raw.addToCarts} ont ajouté un produit au panier.`);
  if (verified.outOfCohortPayments > 0) {
    lines.push(
      `${raw.paymentReached} ont atteint le paiement, mais ${verified.outOfCohortPayments} venaient de paniers créés avant ${periodLabel} ou de sessions non réconciliées.`
    );
  } else if (raw.paymentReached > 0) {
    lines.push(`${raw.paymentReached} ont atteint le paiement.`);
  }
  lines.push(
    `${verified.confirmedOrders} commande${verified.confirmedOrders > 1 ? "s ont" : " a"} été confirmée${verified.confirmedOrders > 1 ? "s" : ""} par Shopify.`
  );

  const atcRate = raw.sessions === 0 ? 0 : (raw.addToCarts / raw.sessions) * 100;
  if (atcRate < 3) {
    lines.push(
      `Le principal blocage est l'ajout panier : seulement ${fmtRate(atcRate)} des visiteurs ont ajouté un produit.`
    );
    lines.push(`Priorité : analyser les produits les plus vus avec 0 ajout panier.`);
  }
  return lines;
}

export function generateInsights(dataset: Dataset, period: Period): Insight[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const raw = computeRawFunnel(sessions);
  const verified = computeVerifiedFunnel(sessions, dataset.orders, period);
  const reliability = computeReliability(dataset, period);
  const products = computeProductStats(dataset, period);
  const sources = computeSourceStats(dataset, period);
  const abandonments = computeAbandonments(dataset, period);
  const orders = ordersInPeriod(dataset.orders, period);

  const insights: Insight[] = [];
  const atcRate = raw.sessions === 0 ? 0 : (raw.addToCarts / raw.sessions) * 100;

  if (atcRate > 0 && atcRate < 3) {
    insights.push({
      id: "ins_atc",
      tone: "critical",
      title: "Blocage principal : l'ajout panier",
      body: `Seulement ${fmtRate(atcRate)} des sessions ont ajouté un produit au panier (${raw.addToCarts} sur ${raw.sessions}). C'est l'étape qui limite tout le funnel.`,
    });
  }

  if (verified.outOfCohortPayments > 0) {
    insights.push({
      id: "ins_cohort",
      tone: "warning",
      title: "Écart expliqué : paiements hors cohorte",
      body: `${verified.outOfCohortPayments} paiement${verified.outOfCohortPayments > 1 ? "s" : ""} atteint${verified.outOfCohortPayments > 1 ? "s" : ""} ne sont pas reliés à des ajouts panier de la période. Cela explique l'écart visible dans Shopify Analytics (${raw.paymentReached} paiements pour ${raw.addToCarts} ajouts panier).`,
    });
  }

  const worstProduct = products.find((p) => p.category === "ameliorer");
  if (worstProduct?.insight) {
    insights.push({ id: "ins_product", tone: "warning", title: "Produit à surveiller", body: worstProduct.insight });
  }

  const gads = sources.find((s) => s.insight && s.key === "google_ads");
  const seo = sources.find((s) => s.insight && s.key === "seo");
  if (gads?.insight) {
    insights.push({ id: "ins_gads", tone: "info", title: "Qualité du trafic Google Ads", body: gads.insight });
  } else if (seo?.insight) {
    insights.push({ id: "ins_seo", tone: "success", title: "Le SEO surperforme", body: seo.insight });
  }

  const totalLoss = abandonments.reduce((a, b) => a + b.estimatedLoss, 0);
  insights.push({
    id: "ins_loss",
    tone: "info",
    title: "Perte estimée récupérable",
    body: `${formatEUR(Math.round(totalLoss))} de chiffre d'affaires potentiellement récupérable sur la période, principalement sur ${
      [...abandonments].sort((a, b) => b.estimatedLoss - a.estimatedLoss)[0].label.toLowerCase()
    }.`,
  });

  insights.push({
    id: "ins_reliability",
    tone: reliability.globalScore >= 85 ? "success" : "warning",
    title: `Fiabilité des données : ${reliability.globalScore}/100`,
    body: `${reliability.anomalyCount} anomalies détectées. ${formatEUR(revenueOf(orders))} de CA confirmé par Shopify sur la période.`,
  });

  return insights;
}

export function generatePriorityActions(dataset: Dataset, period: Period): PriorityAction[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const raw = computeRawFunnel(sessions);
  const products = computeProductStats(dataset, period);
  const abandonments = computeAbandonments(dataset, period);
  const actions: PriorityAction[] = [];

  const productAb = abandonments.find((a) => a.key === "product");
  const toImprove = products.filter((p) => p.category === "ameliorer");
  if (toImprove.length > 0 && productAb) {
    actions.push({
      id: "act_product",
      title: `Retravailler ${toImprove.length > 1 ? `${toImprove.length} fiches produit` : `la fiche « ${toImprove[0].product.title} »`}`,
      description: "Photos en situation, schéma de dimensions, avis clients visibles, réassurance livraison.",
      impact: "high",
      difficulty: "medium",
      type: "produit",
      justification: `${toImprove[0].product.title} : ${toImprove[0].views} vues pour ${toImprove[0].addToCarts} ajout(s) panier (${formatPct(toImprove[0].viewToCartRate)}). Perte estimée sur l'abandon produit : ${formatEUR(Math.round(productAb.estimatedLoss))}.`,
      estimatedRevenue: Math.round(productAb.estimatedLoss),
    });
  }

  const missingUtm = dataset.anomalies.find((a) => a.type === "missing_utm");
  if (missingUtm) {
    actions.push({
      id: "act_utm",
      title: "Ajouter des UTM sur toutes les campagnes Meta / TikTok",
      description: "Y compris les liens bio, stories et boutons in-app, pour rendre chaque vente attribuable.",
      impact: "medium",
      difficulty: "easy",
      type: "tracking",
      justification: `${missingUtm.affectedSessions} sessions à référent publicitaire sans UTM sur 7 jours${
        missingUtm.affectedRevenue ? `, dont du CA confirmé (${formatEUR(missingUtm.affectedRevenue)})` : ""
      } classées « source inconnue ».`,
    });
  }

  const paymentAb = abandonments.find((a) => a.key === "payment");
  if (paymentAb && paymentAb.sessions > 0) {
    actions.push({
      id: "act_payment",
      title: "Récupérer les paiements abandonnés",
      description: "Relance email sous 2 h : le panier et l'email sont connus pour ces sessions. Vérifier la présence de PayPal / Apple Pay.",
      impact: "high",
      difficulty: "easy",
      type: "checkout",
      justification: `${paymentAb.sessions} sessions ont atteint le paiement sans acheter. Valeur en jeu : ${paymentAb.extraMetrics.find((m) => m.label === "Valeur en jeu")?.value ?? "—"}.`,
      estimatedRevenue: Math.round(paymentAb.estimatedLoss),
    });
  }

  const rejectedCodes = sessions.reduce(
    (a, s) => a + s.events.filter((e) => e.eventName === "discount_code_rejected").length,
    0
  );
  if (rejectedCodes > 0) {
    actions.push({
      id: "act_promo",
      title: "Corriger les codes promo en circulation",
      description: "Des codes expirés circulent encore (emails, sites de coupons) et font abandonner au checkout.",
      impact: "medium",
      difficulty: "easy",
      type: "conversion",
      justification: `${rejectedCodes} refus de code promo observé(s) sur la période, suivi(s) d'un abandon de checkout.`,
    });
  }

  const gadsSessions = sessions.filter((s) => s.source === "google" && s.medium === "cpc");
  const gadsAtc = gadsSessions.filter((s) => s.events.some((e) => e.eventName === "product_added_to_cart"));
  if (gadsSessions.length >= 20 && (gadsAtc.length / gadsSessions.length) * 100 < 2) {
    actions.push({
      id: "act_gads",
      title: "Resserrer le ciblage Google Ads (PMax)",
      description: "Exclure les requêtes trop génériques, concentrer le budget sur les campagnes qui génèrent des ajouts panier.",
      impact: "medium",
      difficulty: "medium",
      type: "source",
      justification: `${gadsSessions.length} sessions Google Ads sur la période pour ${gadsAtc.length} ajout(s) panier (${formatPct((gadsAtc.length / Math.max(1, gadsSessions.length)) * 100)}).`,
    });
  }

  void raw;
  return actions;
}
