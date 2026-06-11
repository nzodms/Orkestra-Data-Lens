import type { Anomaly, ShopifyOrder, TrackingEvent, VisitorSession } from "./types";
import { dayOffsetOf, formatEUR } from "./utils";

/**
 * Moteur de réconciliation Orkestra Data Lens.
 *
 * Compare les événements pixel, les sessions, les cart/checkout tokens et les
 * commandes Shopify pour attribuer un statut de vérification à chaque
 * événement, puis produit la liste des anomalies détectées.
 *
 * Règles implémentées :
 *  1. checkout_completed avec orderId correspondant à une commande Shopify → confirmed
 *  2. paiement atteint dont le panier a été créé un jour précédent → out_of_period
 *  3. checkout sans ajout panier dans la session → reconciled (cartToken connu)
 *     ou incomplete (panier inconnu)
 *  4. commande Shopify sans session pixel → anomalie order_without_session
 *  5. événements identiques très rapprochés → doublon potentiel (suspect)
 *  6. trafic payé probable sans UTM → anomalie missing_utm
 */

const PAID_REFERRER_HINTS = ["facebook", "instagram", "tiktok", "l.instagram"];

export function reconcileDataset(
  sessions: VisitorSession[],
  orders: ShopifyOrder[],
  shopId = "shop_demo_01"
): Anomaly[] {
  const orderIds = new Set(orders.map((o) => o.id));
  const anomalies: Anomaly[] = [];

  const outOfPeriodPaymentSessions: VisitorSession[] = [];
  const unknownCartCheckoutSessions: VisitorSession[] = [];
  const resumedCartSessions: VisitorSession[] = [];
  const missingUtmSessions: VisitorSession[] = [];
  const duplicateSessions: VisitorSession[] = [];

  for (const session of sessions) {
    const events = session.events;
    const hasAtcInSession = events.some((e) => e.eventName === "product_added_to_cart");
    const sessionDay = dayOffsetOf(session.startedAt);

    for (const event of events) {
      // Règle 1 — confirmation par commande Shopify
      if (
        (event.eventName === "checkout_completed" || event.eventName === "order_created" || event.eventName === "order_paid") &&
        event.orderId &&
        orderIds.has(event.orderId)
      ) {
        event.status = "confirmed";
      }

      // Règle 2 — panier créé avant la période du paiement
      if (event.eventName === "payment_step_reached" || event.eventName === "checkout_started") {
        const cartCreatedAt = (event.metadata?.cartCreatedAt as string | undefined) ?? findCartCreatedAt(events, event);
        if (cartCreatedAt && dayOffsetOf(cartCreatedAt) > dayOffsetOf(event.timestamp) && event.status === "observed") {
          event.status = event.eventName === "payment_step_reached" ? "out_of_period" : "reconciled";
        }
      }

      // Règle 3 — checkout sans ajout panier dans la session
      if (event.eventName === "checkout_started" && !hasAtcInSession) {
        if (event.cartToken || event.metadata?.cartCreatedAt) {
          if (event.status === "observed") event.status = "reconciled";
          resumedCartSessions.push(session);
        } else {
          event.status = "incomplete";
          unknownCartCheckoutSessions.push(session);
        }
      }
    }

    // Paiement hors cohorte du jour (panier antérieur ou inconnu)
    const payment = events.find((e) => e.eventName === "payment_step_reached");
    if (payment && (payment.status === "out_of_period" || payment.status === "incomplete")) {
      if (dayOffsetOf(payment.timestamp) === 0) outOfPeriodPaymentSessions.push(session);
    }

    // Règle 5 — doublons potentiels
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1];
      const b = events[i];
      if (
        a.eventName === b.eventName &&
        a.productId === b.productId &&
        a.eventName !== "discount_code_entered" &&
        Math.abs(new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) < 5000 &&
        ["product_viewed", "product_added_to_cart", "page_viewed"].includes(a.eventName)
      ) {
        b.status = "suspect";
        b.metadata = { ...b.metadata, duplicateOf: a.id };
        duplicateSessions.push(session);
      }
    }

    // Règle 6 — trafic payé probable sans UTM
    const start = events.find((e) => e.eventName === "session_started");
    const suspectedPaid =
      start?.metadata?.suspectedPaid === true ||
      (!session.medium && !!start?.referrer && PAID_REFERRER_HINTS.some((h) => start.referrer!.includes(h)));
    if (suspectedPaid && !session.campaign && sessionDay <= 6) {
      missingUtmSessions.push(session);
    }
  }

  // Règle 4 — commandes Shopify sans session pixel
  const sessionIdSet = new Set(sessions.map((s) => s.id));
  const orphanOrders = orders.filter((o) => !o.sessionId || !sessionIdSet.has(o.sessionId));

  const now = new Date().toISOString();
  const push = (a: Omit<Anomaly, "shopId" | "detectedAt">) =>
    anomalies.push({ ...a, shopId, detectedAt: now });

  const lostPaymentRevenue = outOfPeriodPaymentSessions.reduce(
    (acc, s) => acc + (s.events.find((e) => e.eventName === "payment_step_reached")?.price ?? 0),
    0
  );

  const todaySessions = sessions.filter((s) => dayOffsetOf(s.startedAt) === 0);
  const todayAtc = todaySessions.filter((s) =>
    s.events.some((e) => e.eventName === "product_added_to_cart")
  ).length;
  const todayPayments = todaySessions.filter((s) =>
    s.events.some((e) => e.eventName === "payment_step_reached")
  ).length;

  if (outOfPeriodPaymentSessions.length > 0) {
    push({
      id: "ano_payment_no_atc",
      type: "payment_without_add_to_cart",
      severity: "high",
      title: "Paiements atteints sans ajout panier sur la période",
      description: `${outOfPeriodPaymentSessions.length} sessions ont atteint l'étape paiement aujourd'hui sans ajout panier observé sur la même période. C'est la cause de l'écart « ${todayPayments} paiements atteints pour ${todayAtc} ajouts panier » visible dans Shopify Analytics.`,
      affectedSessions: outOfPeriodPaymentSessions.length,
      affectedRevenue: Math.round(lostPaymentRevenue * 100) / 100,
      probableCause: "Paniers créés avant la période, checkouts repris via email/retargeting, ou panier constitué sur un autre appareil.",
      recommendedAction: "Aucune correction nécessaire : l'écart est expliqué. Suivre ces paiements dans le funnel vérifié plutôt que dans le funnel brut.",
    });
  }

  const outOfPeriodCarts = sessions.filter(
    (s) =>
      dayOffsetOf(s.startedAt) === 0 &&
      s.events.some((e) => {
        const created = e.metadata?.cartCreatedAt as string | undefined;
        return created && dayOffsetOf(created) > 0;
      })
  );
  if (outOfPeriodCarts.length > 0) {
    push({
      id: "ano_out_of_period",
      type: "out_of_period_event",
      severity: "medium",
      title: "Paniers créés avant la période",
      description: `${outOfPeriodCarts.length} sessions d'aujourd'hui reprennent un panier créé un jour précédent. Shopify compte leurs étapes checkout dans la période du jour, ce qui gonfle le funnel brut.`,
      affectedSessions: outOfPeriodCarts.length,
      probableCause: "Clients qui reviennent finaliser un achat commencé la veille (emails panier abandonné, retargeting, retour direct).",
      recommendedAction: "Comparer funnel brut et funnel cohorte pour juger la conversion réelle du jour.",
    });
  }

  if (unknownCartCheckoutSessions.length > 0) {
    const revenue = unknownCartCheckoutSessions.reduce(
      (acc, s) => acc + (s.events.find((e) => e.eventName === "payment_step_reached")?.price ?? 0),
      0
    );
    push({
      id: "ano_checkout_no_cart",
      type: "checkout_without_cart",
      severity: "high",
      title: "Checkout sans panier identifié",
      description: `${unknownCartCheckoutSessions.length} session a commencé un checkout (panier de ${formatEUR(revenue)}) sans qu'aucun ajout panier ne soit rattachable, même sur les jours précédents.`,
      affectedSessions: unknownCartCheckoutSessions.length,
      affectedRevenue: revenue,
      probableCause: "Panier constitué sur un autre appareil ou navigateur, ou événement add_to_cart bloqué (consentement, bloqueur de publicité).",
      recommendedAction: "Vérifier la couverture du pixel sur toutes les pages et le taux de consentement cookies.",
    });
  }

  if (orphanOrders.length > 0) {
    push({
      id: "ano_order_no_session",
      type: "order_without_session",
      severity: "high",
      title: "Commande Shopify sans session pixel",
      description: `${orphanOrders.length} commande (${orphanOrders.map((o) => o.orderNumber).join(", ")}, ${formatEUR(orphanOrders.reduce((a, o) => a + o.totalPrice, 0))}) existe dans Shopify sans aucun événement de tracking associé.`,
      affectedSessions: orphanOrders.length,
      affectedRevenue: orphanOrders.reduce((a, o) => a + o.totalPrice, 0),
      probableCause: "Tracking bloqué côté client (consentement refusé, bloqueur), ou commande créée hors boutique en ligne (commande brouillon, POS).",
      recommendedAction: "La commande reste comptée dans le CA (source Shopify). Surveiller le taux de commandes non réconciliées : au-delà de 10 %, auditer l'installation du pixel.",
    });
  }

  if (missingUtmSessions.length > 0) {
    const missingUtmSessionIds = new Set(missingUtmSessions.map((s) => s.id));
    const missingUtmOrders = orders.filter((o) => o.sessionId && missingUtmSessionIds.has(o.sessionId));
    const missingUtmRevenue = missingUtmOrders.reduce((a, o) => a + o.totalPrice, 0);
    push({
      id: "ano_missing_utm",
      type: "missing_utm",
      severity: "medium",
      title: "Trafic payé probable sans UTM",
      description: `${missingUtmSessions.length} sessions sur 7 jours arrivent depuis un référent publicitaire (Facebook, Instagram, TikTok) sans paramètres UTM. Leur source est classée « inconnue »${
        missingUtmOrders.length > 0
          ? `, dont ${missingUtmOrders.length} session${missingUtmOrders.length > 1 ? "s" : ""} avec achat confirmé`
          : ""
      }.`,
      affectedSessions: missingUtmSessions.length,
      affectedRevenue: missingUtmRevenue > 0 ? missingUtmRevenue : undefined,
      probableCause: "UTM absents ou tronqués sur certaines publicités (liens bio, stories, boutons in-app).",
      recommendedAction: "Ajouter des UTM systématiques sur toutes les campagnes Meta/TikTok, y compris les liens organiques de profil.",
    });
  }

  if (duplicateSessions.length > 0) {
    push({
      id: "ano_duplicate",
      type: "duplicate_event",
      severity: "low",
      title: "Événements doublons détectés",
      description: `${duplicateSessions.length} session contient des événements identiques déclenchés à moins de 5 secondes d'intervalle. Les doublons sont exclus des métriques vérifiées.`,
      affectedSessions: duplicateSessions.length,
      probableCause: "Double déclenchement du pixel (re-render, double clic, app de thème).",
      recommendedAction: "Aucune action requise : la déduplication est automatique. Si le volume augmente, vérifier les apps de thème installées.",
    });
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  anomalies.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return anomalies;
}

function findCartCreatedAt(events: TrackingEvent[], ref: TrackingEvent): string | undefined {
  if (!ref.cartToken && !ref.checkoutToken) return undefined;
  const atc = events.find(
    (e) => e.eventName === "product_added_to_cart" && (e.cartToken === ref.cartToken || !!ref.checkoutToken)
  );
  if (atc) return atc.timestamp;
  const meta = events.find((e) => e.metadata?.cartCreatedAt)?.metadata?.cartCreatedAt as string | undefined;
  return meta;
}
