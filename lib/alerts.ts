import type { OperationalAlert } from "./activity";
import type { DeskData } from "./orderdesk/types";
import { daysSince, estimatedMarginPct } from "./orderdesk/types";
import type { Dataset } from "./types";
import { computeRawFunnel, computeVerifiedFunnel, ordersInPeriod, sessionsInPeriod } from "./funnel";
import { formatEUR } from "./utils";

/**
 * Moteur d'alertes opérationnelles — pur et déterministe.
 * Les alertes sont recalculées à chaque lecture avec des clés stables
 * (`type:entityId`) ; leurs statuts (résolue / snoozée) sont persistés à part
 * et fusionnés via mergeAlertStates.
 */

type HealthInput = {
  mode: "demo" | "live";
  pixelStatus?: string;
  lastEventAt?: string | null;
};

const HOURS = 3600 * 1000;

export function computeAlertCandidates(
  desk: DeskData,
  dataset: Dataset,
  health: HealthInput
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const now = new Date().toISOString();
  const shopId = dataset.shop.id;

  const push = (a: Omit<OperationalAlert, "shopId" | "status" | "createdAt">) =>
    alerts.push({ ...a, shopId, status: "active", createdAt: now });

  // ─── Commandes (Order Desk) ────────────────────────────────────────────────

  for (const order of desk.orders) {
    const age = daysSince(order.createdAt);
    const orderHref = `/orders?q=${encodeURIComponent(order.orderNumber)}`;
    const margin = estimatedMarginPct(order, desk.offers);
    const orderMessages = desk.messages.filter((m) => m.orderId === order.id);

    if (["todo", "sourcing"].includes(order.opsStatus) && !order.supplierId && age >= 1) {
      push({
        id: `order_no_supplier:${order.id}`,
        type: "order_no_supplier",
        category: "orderdesk",
        severity: age >= 2 ? "high" : "medium",
        title: `${order.orderNumber} sans fournisseur depuis ${age} j`,
        description: `${order.lineItems[0]?.title ?? "Commande"} (${formatEUR(order.totalPrice)}) attend un fournisseur depuis ${age} jour${age > 1 ? "s" : ""}.`,
        recommendedAction: "Comparer les fournisseurs et assigner le meilleur.",
        href: orderHref,
        entityType: "order",
        entityId: order.id,
      });
    }

    if (order.opsStatus === "message_sent") {
      const lastSent = orderMessages
        .filter((m) => m.sentAt)
        .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))[0];
      const silentHours = lastSent?.sentAt
        ? Math.floor((Date.now() - new Date(lastSent.sentAt).getTime()) / HOURS)
        : null;
      if (silentHours != null && silentHours >= 48) {
        push({
          id: `supplier_silent:${order.id}`,
          type: "supplier_no_reply_48h",
          category: "supplier",
          severity: "high",
          title: `${lastSent?.supplierName ?? "Fournisseur"} sans réponse depuis ${Math.floor(silentHours / 24)} j (${order.orderNumber})`,
          description: `Message envoyé il y a ${silentHours} h sans réponse enregistrée.`,
          recommendedAction: "Envoyer la relance 48 h, ou basculer sur un autre fournisseur.",
          href: orderHref,
          entityType: "order",
          entityId: order.id,
        });
      }
    }

    const orderQuotes = desk.quotes.filter((q) => q.orderId === order.id && q.status === "received");
    if (order.opsStatus === "price_compare" && orderQuotes.length > 0 && !order.supplierId) {
      push({
        id: `price_no_choice:${order.id}`,
        type: "price_received_no_choice",
        category: "orderdesk",
        severity: "medium",
        title: `${order.orderNumber} : ${orderQuotes.length} prix reçus, aucun fournisseur choisi`,
        description: "Les devis sont là — la commande attend une décision.",
        recommendedAction: "Ouvrir la comparaison et choisir le fournisseur recommandé.",
        href: orderHref,
        entityType: "order",
        entityId: order.id,
      });
    }

    if (order.opsStatus === "supplier_chosen" && age >= 1) {
      push({
        id: `chosen_no_payment:${order.id}`,
        type: "chosen_no_payment",
        category: "orderdesk",
        severity: "medium",
        title: `${order.orderNumber} : fournisseur choisi mais commande non passée`,
        description: `Fournisseur assigné depuis ${age} j sans confirmation ni paiement fournisseur.`,
        recommendedAction: "Envoyer la confirmation de commande puis marquer le paiement.",
        href: orderHref,
        entityType: "order",
        entityId: order.id,
      });
    }

    if ((order.opsStatus === "ordered" || order.opsStatus === "tracking_pending") && !order.trackingNumber && age >= 3) {
      push({
        id: `no_tracking:${order.id}`,
        type: "paid_no_tracking",
        category: "orderdesk",
        severity: age >= 5 ? "critical" : "high",
        title: `${order.orderNumber} sans tracking depuis ${age} j`,
        description: `Commande fournisseur passée, aucun numéro de suivi reçu.`,
        recommendedAction: "Demander le tracking au fournisseur (template dédié).",
        href: orderHref,
        entityType: "tracking",
        entityId: order.id,
      });
    }

    if (margin != null && margin < 40 && !["shipped", "problem", "sav"].includes(order.opsStatus)) {
      push({
        id: `low_margin:${order.id}`,
        type: "low_margin_order",
        category: "product",
        severity: margin < 25 ? "high" : "medium",
        title: `${order.orderNumber} : marge estimée ${margin} %`,
        description: `${order.lineItems[0]?.title ?? "Produit"} — coût fournisseur trop élevé par rapport au prix client.`,
        recommendedAction: "Négocier le prix ou re-sourcer le produit.",
        href: orderHref,
        entityType: "order",
        entityId: order.id,
      });
    }

    const prepared = orderMessages.filter(
      (m) => m.status === "prepared" && Date.now() - new Date(m.preparedAt).getTime() > 12 * HOURS
    );
    if (prepared.length > 0) {
      push({
        id: `msg_not_sent:${order.id}`,
        type: "message_prepared_not_sent",
        category: "orderdesk",
        severity: "low",
        title: `${order.orderNumber} : message préparé mais jamais envoyé`,
        description: `${prepared.length} message${prepared.length > 1 ? "s" : ""} WhatsApp en attente d'envoi manuel depuis 12 h+.`,
        recommendedAction: "Ouvrir WhatsApp depuis la page Messages, puis marquer comme envoyé.",
        href: "/messages",
        entityType: "order",
        entityId: order.id,
      });
    }
  }

  // ─── Data Lens (tracking / funnel) ────────────────────────────────────────

  if (health.mode === "live") {
    if (health.pixelStatus !== "installed") {
      push({
        id: "pixel_inactive:shop",
        type: "pixel_inactive",
        category: "tracking",
        severity: "critical",
        title: "Web Pixel inactif",
        description: `Statut actuel : ${health.pixelStatus ?? "inconnu"}. Sans pixel, aucune session n'est reconstruite.`,
        recommendedAction: "Réinstaller le pixel depuis Santé des données.",
        href: "/system",
        entityType: "system",
        entityId: "pixel",
      });
    }
    const lastEventAge = health.lastEventAt
      ? Math.floor((Date.now() - new Date(health.lastEventAt).getTime()) / HOURS)
      : null;
    if (health.pixelStatus === "installed" && (lastEventAge == null || lastEventAge >= 6)) {
      push({
        id: "tracking_silent:shop",
        type: "tracking_silent",
        category: "tracking",
        severity: "high",
        title: lastEventAge == null ? "Aucune donnée tracking reçue" : `Aucune donnée tracking depuis ${lastEventAge} h`,
        description: "Le pixel est marqué installé mais n'envoie plus d'événements.",
        recommendedAction: "Tester le tracking depuis Santé des données.",
        href: "/system",
        entityType: "system",
        entityId: "tracking",
      });
    }
  }

  const todaySessions = sessionsInPeriod(dataset.sessions, "today");
  const raw = computeRawFunnel(todaySessions);
  const verified = computeVerifiedFunnel(todaySessions, dataset.orders, "today");

  if (verified.outOfCohortPayments >= 3) {
    push({
      id: "cohort_spike:today",
      type: "out_of_cohort_spike",
      category: "funnel",
      severity: "medium",
      title: `${verified.outOfCohortPayments} paiements hors cohorte aujourd'hui`,
      description: `${raw.paymentReached} paiements atteints pour ${raw.addToCarts} ajouts panier : Shopify mélange des parcours antérieurs.`,
      recommendedAction: "Vérifier la décomposition dans la Vérité du tunnel — l'écart est expliqué, pas besoin de corriger.",
      href: "/truth-funnel",
      entityType: "anomaly",
      entityId: "cohort",
    });
  }

  const orphanOrders = ordersInPeriod(dataset.orders, "7d").filter((o) => !o.sessionId);
  if (orphanOrders.length > 0) {
    push({
      id: "orders_no_session:7d",
      type: "orders_without_session",
      category: "tracking",
      severity: "high",
      title: `${orphanOrders.length} commande${orphanOrders.length > 1 ? "s" : ""} Shopify sans session trackée`,
      description: `${formatEUR(orphanOrders.reduce((a, o) => a + o.totalPrice, 0))} de CA non rattaché à un parcours (consentement refusé, bloqueur, POS).`,
      recommendedAction: "Surveiller le taux : au-delà de 10 %, auditer l'installation du pixel.",
      href: "/anomalies",
      entityType: "anomaly",
      entityId: "orphan_orders",
    });
  }

  const missingUtm = dataset.anomalies.find((a) => a.type === "missing_utm");
  if (missingUtm) {
    push({
      id: "missing_utm:7d",
      type: "missing_utm_paid",
      category: "funnel",
      severity: "medium",
      title: "UTM manquants sur trafic payé probable",
      description: missingUtm.description,
      recommendedAction: missingUtm.recommendedAction,
      href: "/sources",
      entityType: "anomaly",
      entityId: "missing_utm",
    });
  }

  if (raw.sessions >= 50) {
    const atcRate = (raw.addToCarts / raw.sessions) * 100;
    if (atcRate < 1.5) {
      push({
        id: "low_atc:today",
        type: "low_add_to_cart_rate",
        category: "funnel",
        severity: "medium",
        title: `Taux d'ajout panier anormalement bas : ${atcRate.toFixed(2).replace(".", ",")} %`,
        description: `${raw.addToCarts} ajouts panier pour ${raw.sessions} sessions aujourd'hui.`,
        recommendedAction: "Analyser les produits les plus vus sans ajout panier.",
        href: "/abandonments",
        entityType: "anomaly",
        entityId: "atc",
      });
    }
  }

  if (raw.paymentReached >= 4) {
    const abandonRate = ((raw.paymentReached - raw.ordersCompleted) / raw.paymentReached) * 100;
    if (abandonRate > 60) {
      push({
        id: "payment_abandon:today",
        type: "high_payment_abandon",
        category: "funnel",
        severity: "medium",
        title: `Abandon paiement élevé : ${Math.round(abandonRate)} %`,
        description: `${raw.paymentReached - raw.ordersCompleted} des ${raw.paymentReached} paiements atteints n'ont pas abouti aujourd'hui.`,
        recommendedAction: "Vérifier moyens de paiement et relancer les paniers connus.",
        href: "/abandonments",
        entityType: "anomaly",
        entityId: "payment",
      });
    }
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return alerts;
}
