import type { FunnelMetrics, Period, ShopifyOrder, VerifiedFunnelMetrics, VisitorSession } from "./types";
import { dayOffsetOf } from "./utils";

// ─── Filtrage par période ─────────────────────────────────────────────────────

export function periodRange(period: Period): { min: number; max: number } {
  if (period === "today") return { min: 0, max: 0 };
  if (period === "yesterday") return { min: 1, max: 1 };
  return { min: 0, max: 6 };
}

export function sessionsInPeriod(sessions: VisitorSession[], period: Period): VisitorSession[] {
  const { min, max } = periodRange(period);
  return sessions.filter((s) => {
    const o = dayOffsetOf(s.startedAt);
    return o >= min && o <= max;
  });
}

export function ordersInPeriod(orders: ShopifyOrder[], period: Period): ShopifyOrder[] {
  const { min, max } = periodRange(period);
  return orders.filter((o) => {
    const d = dayOffsetOf(o.createdAt);
    return d >= min && d <= max;
  });
}

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7d": "7 derniers jours",
};

export function parsePeriod(raw?: string): Period {
  return raw === "yesterday" || raw === "7d" ? raw : "today";
}

// ─── Funnel brut ──────────────────────────────────────────────────────────────

const has = (s: VisitorSession, eventName: string) => s.events.some((e) => e.eventName === eventName);

/**
 * Funnel brut : compte les sessions ayant déclenché chaque événement sur la
 * période, sans vérifier l'ordre ni l'origine — c'est ce que montre Shopify
 * Analytics, et c'est ce qui produit des chiffres apparemment incohérents
 * (ex. 5 paiements atteints pour 2 ajouts panier).
 */
export function computeRawFunnel(sessions: VisitorSession[]): FunnelMetrics {
  return {
    sessions: sessions.length,
    productViews: sessions.filter((s) => has(s, "product_viewed")).length,
    addToCarts: sessions.filter((s) => has(s, "product_added_to_cart")).length,
    cartViews: sessions.filter((s) => has(s, "cart_viewed")).length,
    checkoutsStarted: sessions.filter((s) => has(s, "checkout_started")).length,
    contactSubmitted: sessions.filter((s) => has(s, "checkout_contact_info_submitted")).length,
    shippingSubmitted: sessions.filter((s) => has(s, "checkout_shipping_info_submitted")).length,
    paymentReached: sessions.filter((s) => has(s, "payment_step_reached")).length,
    paymentSubmitted: sessions.filter((s) => has(s, "payment_info_submitted")).length,
    ordersCompleted: sessions.filter((s) => has(s, "checkout_completed")).length,
  };
}

// ─── Funnel vérifié / cohorte ────────────────────────────────────────────────

/** Le checkout de cette session démarre-t-il d'un panier créé dans la période ? */
export function isCohortCheckout(s: VisitorSession, period: Period): boolean {
  const checkout = s.events.find((e) => e.eventName === "checkout_started");
  if (!checkout) return false;
  if (checkout.status === "incomplete") return false; // panier inconnu
  const created = checkout.metadata?.cartCreatedAt as string | undefined;
  if (!created) return s.events.some((e) => e.eventName === "product_added_to_cart");
  const { min, max } = periodRange(period);
  const d = dayOffsetOf(created);
  return d >= min && d <= max;
}

function isCohortPayment(s: VisitorSession, period: Period): boolean {
  const payment = s.events.find((e) => e.eventName === "payment_step_reached");
  if (!payment) return false;
  if (payment.status === "out_of_period" || payment.status === "incomplete") {
    // hors période pour le jour J ; sur 7 jours, un panier créé dans la
    // fenêtre redevient « dans la cohorte »
    const created = payment.metadata?.cartCreatedAt as string | undefined;
    if (!created) return false;
    const { min, max } = periodRange(period);
    const d = dayOffsetOf(created);
    return d >= min && d <= max;
  }
  return isCohortCheckout(s, period);
}

/**
 * Funnel vérifié : reconstruit les parcours session par session, dans l'ordre,
 * en ne comptant à chaque étape que les sessions dont l'étape précédente a eu
 * lieu dans la même période. Les paiements issus de paniers antérieurs sont
 * isolés en « hors cohorte » au lieu de gonfler le funnel.
 */
export function computeVerifiedFunnel(
  sessions: VisitorSession[],
  orders: ShopifyOrder[],
  period: Period
): VerifiedFunnelMetrics {
  const raw = computeRawFunnel(sessions);

  const pv = sessions.filter((s) => s.events.some((e) => e.eventName === "product_viewed" && e.status !== "suspect"));
  const atc = sessions.filter((s) => s.events.some((e) => e.eventName === "product_added_to_cart" && e.status !== "suspect"));
  const cartViews = atc.filter((s) => has(s, "cart_viewed"));
  const cohortCheckouts = sessions.filter((s) => isCohortCheckout(s, period));
  const cohortPayments = sessions.filter((s) => isCohortPayment(s, period));
  const cohortContact = cohortCheckouts.filter((s) => has(s, "checkout_contact_info_submitted"));
  const cohortShipping = cohortCheckouts.filter((s) => has(s, "checkout_shipping_info_submitted"));
  const cohortPaymentSubmitted = cohortPayments.filter((s) => has(s, "payment_info_submitted"));
  const confirmedOrderSessions = sessions.filter((s) =>
    s.events.some((e) => e.eventName === "checkout_completed" && e.status === "confirmed")
  );

  const identifiedCheckouts = sessions.filter((s) => {
    const c = s.events.find((e) => e.eventName === "checkout_started");
    return c && c.status !== "incomplete";
  }).length;

  return {
    sessions: raw.sessions,
    productViews: pv.length,
    addToCarts: atc.length,
    cartViews: cartViews.length,
    checkoutsStarted: cohortCheckouts.length,
    contactSubmitted: cohortContact.length,
    shippingSubmitted: cohortShipping.length,
    paymentReached: cohortPayments.length,
    paymentSubmitted: cohortPaymentSubmitted.length,
    ordersCompleted: confirmedOrderSessions.length,
    outOfCohortCheckouts: raw.checkoutsStarted - cohortCheckouts.length,
    outOfCohortPayments: raw.paymentReached - cohortPayments.length,
    missingAddToCartEvents: sessions.filter((s) =>
      s.events.some((e) => e.eventName === "checkout_started" && e.status === "incomplete")
    ).length,
    confirmedOrders: ordersInPeriod(orders, period).length,
    reconciliationRate:
      raw.checkoutsStarted === 0 ? 100 : Math.round((identifiedCheckouts / raw.checkoutsStarted) * 1000) / 10,
  };
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

export type FunnelStep = {
  key: string;
  label: string;
  raw: number;
  verified: number;
  note?: string;
};

export function buildFunnelSteps(raw: FunnelMetrics, verified: VerifiedFunnelMetrics): FunnelStep[] {
  return [
    { key: "sessions", label: "Sessions", raw: raw.sessions, verified: verified.sessions },
    { key: "productViews", label: "Vues produit", raw: raw.productViews, verified: verified.productViews },
    { key: "addToCarts", label: "Ajouts panier", raw: raw.addToCarts, verified: verified.addToCarts },
    {
      key: "checkoutsStarted",
      label: "Checkouts commencés",
      raw: raw.checkoutsStarted,
      verified: verified.checkoutsStarted,
      note: verified.outOfCohortCheckouts > 0 ? `+${verified.outOfCohortCheckouts} hors cohorte` : undefined,
    },
    {
      key: "paymentReached",
      label: "Paiements atteints",
      raw: raw.paymentReached,
      verified: verified.paymentReached,
      note: verified.outOfCohortPayments > 0 ? `+${verified.outOfCohortPayments} hors cohorte` : undefined,
    },
    {
      key: "ordersCompleted",
      label: "Commandes confirmées",
      raw: raw.ordersCompleted,
      verified: verified.confirmedOrders,
    },
  ];
}

export function revenueOf(orders: ShopifyOrder[]): number {
  return Math.round(orders.reduce((acc, o) => acc + o.totalPrice, 0) * 100) / 100;
}
