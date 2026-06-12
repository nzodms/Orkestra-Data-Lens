import type { Dataset, Period, Product, ShopifyOrder, VisitorSession } from "./types";
import { classifySource, SOURCE_LABELS, type SourceKey } from "./events";
import { ordersInPeriod, sessionsInPeriod } from "./funnel";

// ─── Analyse produits ─────────────────────────────────────────────────────────

export type ProductCategory = "scaler" | "ameliorer" | "bloque_checkout" | "suspect" | "couper" | "correct";

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  scaler: "À scaler",
  ameliorer: "À améliorer",
  bloque_checkout: "Bloque au checkout",
  suspect: "Données suspectes",
  couper: "À couper",
  correct: "Correct",
};

export type ProductStats = {
  product: Product;
  views: number;
  addToCarts: number;
  viewToCartRate: number;
  checkouts: number;
  purchases: number;
  purchaseRate: number;
  revenue: number;
  estimatedMargin: number;
  refunds: number;
  conversionScore: number;
  frictionScore: number;
  dataReliability: number;
  category: ProductCategory;
  recommendedAction: string;
  insight?: string;
};

export function computeProductStats(dataset: Dataset, period: Period): ProductStats[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);

  return dataset.products
    .map((product) => {
      const viewSessions = sessions.filter((s) =>
        s.events.some((e) => e.eventName === "product_viewed" && e.productId === product.id)
      );
      const atcSessions = sessions.filter((s) =>
        s.events.some((e) => e.eventName === "product_added_to_cart" && e.productId === product.id)
      );
      const checkoutSessions = atcSessions.filter((s) =>
        s.events.some((e) => e.eventName === "checkout_started")
      );
      const productOrders = orders.filter((o) => o.productIds.includes(product.id));
      const revenue = round2(productOrders.reduce((acc, o) => acc + o.totalPrice, 0));
      const marginRate = product.cost ? 1 - product.cost / product.priceMin : 0.5;
      const views = viewSessions.length;
      const atc = atcSessions.length;
      const purchases = productOrders.length;
      const viewToCartRate = views === 0 ? 0 : (atc / views) * 100;
      const purchaseRate = views === 0 ? 0 : (purchases / views) * 100;

      const suspectEvents = sessions.filter((s) =>
        s.events.some((e) => e.productId === product.id && e.status === "suspect")
      ).length;
      const dataReliability = views === 0 ? 100 : Math.max(0, Math.round(100 - (suspectEvents / views) * 100));

      // Score de conversion : vue→panier et vue→achat normalisés vs benchmark e-commerce
      const conversionScore = Math.min(
        100,
        Math.round((viewToCartRate / 6) * 50 + (purchaseRate / 1.8) * 50)
      );
      // Score de friction : élevé quand le produit perd ses acheteurs après l'ajout panier
      const frictionScore =
        atc === 0 ? 0 : Math.round(100 * (1 - purchases / atc));

      let category: ProductCategory = "correct";
      if (dataReliability < 80) category = "suspect";
      else if (views >= 20 && atc >= 2 && purchases / Math.max(1, atc) < 0.34 && frictionScore >= 65) category = "bloque_checkout";
      else if (views >= 25 && viewToCartRate < 1.6) category = "ameliorer";
      else if (purchases >= 2 && viewToCartRate >= 3 && marginRate >= 0.55) category = "scaler";
      else if (views >= 30 && purchases === 0 && viewToCartRate < 1 && marginRate < 0.6) category = "couper";

      const recommendedAction = {
        scaler: "Augmenter le budget publicitaire sur ce produit : le funnel complet est sain.",
        ameliorer: "Retravailler la fiche produit (photos, dimensions, avis) : le trafic arrive mais n'ajoute pas au panier.",
        bloque_checkout: "Vérifier frais de livraison, prix final et moyens de paiement : les paniers n'aboutissent pas.",
        suspect: "Auditer le tracking de ce produit avant toute décision : données incomplètes.",
        couper: "Faible conversion et faible marge : envisager de retirer ce produit du catalogue payant.",
        correct: "Performance dans la norme : maintenir et surveiller.",
      }[category];

      let insight: string | undefined;
      if (category === "ameliorer") {
        insight = `${product.title} reçoit ${views} vues mais seulement ${atc} ajout${atc > 1 ? "s" : ""} panier (${fmtRate(viewToCartRate)}). Le problème semble venir de la fiche produit ou de l'offre.`;
      } else if (category === "bloque_checkout") {
        insight = `${product.title} a un bon taux d'ajout panier, mais ${frictionScore}% des paniers n'aboutissent pas. Vérifier livraison, prix final et moyens de paiement.`;
      } else if (category === "scaler") {
        insight = `${product.title} convertit bien à chaque étape avec ${Math.round(marginRate * 100)}% de marge estimée : candidat à scaler.`;
      }

      return {
        product,
        views,
        addToCarts: atc,
        viewToCartRate: round1(viewToCartRate),
        checkouts: checkoutSessions.length,
        purchases,
        purchaseRate: round1(purchaseRate),
        revenue,
        estimatedMargin: round2(revenue * marginRate),
        refunds: 0,
        conversionScore,
        frictionScore,
        dataReliability,
        category,
        recommendedAction,
        insight,
      };
    })
    .sort((a, b) => b.views - a.views);
}

// ─── Analyse sources ──────────────────────────────────────────────────────────

export type SourceStats = {
  key: SourceKey;
  label: string;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  orders: number;
  revenue: number;
  avgOrderValue: number;
  viewRate: number;
  viewToCartRate: number;
  cartToCheckoutRate: number;
  checkoutToOrderRate: number;
  qualityScore: number;
  insight?: string;
};

export function computeSourceStats(dataset: Dataset, period: Period): SourceStats[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);

  const groups = new Map<SourceKey, VisitorSession[]>();
  for (const s of sessions) {
    const key = classifySource(s.source, s.medium);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const stats: SourceStats[] = [];
  for (const [key, group] of groups) {
    const pv = group.filter((s) => s.events.some((e) => e.eventName === "product_viewed")).length;
    const atc = group.filter((s) => s.events.some((e) => e.eventName === "product_added_to_cart")).length;
    const checkout = group.filter((s) => s.events.some((e) => e.eventName === "checkout_started")).length;
    const srcOrders = orders.filter((o) =>
      o.sessionId ? group.some((s) => s.id === o.sessionId) : key === "unknown"
    );
    const revenue = round2(srcOrders.reduce((acc, o) => acc + o.totalPrice, 0));
    const n = group.length;
    const viewRate = pct(pv, n);
    const viewToCartRate = pct(atc, pv);
    const cartToCheckoutRate = pct(checkout, atc);
    const checkoutToOrderRate = pct(srcOrders.length, checkout);

    // Qualité du trafic : profondeur d'engagement et conversion, pondérées
    const qualityScore = Math.min(
      100,
      Math.round(
        viewRate * 0.35 +
          Math.min(100, (atc / Math.max(1, n)) * 100 * 8) * 0.35 +
          Math.min(100, (srcOrders.length / Math.max(1, n)) * 100 * 25) * 0.3
      )
    );

    stats.push({
      key,
      label: SOURCE_LABELS[key],
      sessions: n,
      productViews: pv,
      addToCarts: atc,
      checkouts: checkout,
      orders: srcOrders.length,
      revenue,
      avgOrderValue: srcOrders.length === 0 ? 0 : round2(revenue / srcOrders.length),
      viewRate: round1(viewRate),
      viewToCartRate: round1(viewToCartRate),
      cartToCheckoutRate: round1(cartToCheckoutRate),
      checkoutToOrderRate: round1(checkoutToOrderRate),
      qualityScore,
    });
  }

  stats.sort((a, b) => b.sessions - a.sessions);

  // Insights comparatifs basés sur les données réelles du dataset
  const gads = stats.find((s) => s.key === "google_ads");
  const seo = stats.find((s) => s.key === "seo");
  if (gads && gads.sessions >= 10) {
    const atcShare = (gads.addToCarts / gads.sessions) * 100;
    if (atcShare < 2) {
      gads.insight = `Google Ads génère ${gads.sessions} sessions, mais seulement ${fmtRate(atcShare)} d'ajouts panier. Le ciblage est probablement trop large ou les fiches produit ne répondent pas à l'intention.`;
    }
  }
  if (seo && gads && seo.viewRate > 0 && gads.viewRate > 0) {
    const ratio = seo.viewRate / Math.max(1, gads.viewRate);
    if (ratio > 1.15) {
      seo.insight = `Le SEO génère moins de trafic, mais un taux de consultation produit ${ratio.toFixed(1).replace(".", ",")}x supérieur à Google Ads : trafic plus qualifié.`;
    }
  }

  return stats;
}

// ─── Analyse des abandons ─────────────────────────────────────────────────────

export type AbandonmentStats = {
  key: "product" | "cart" | "checkout" | "payment";
  label: string;
  description: string;
  sessions: number;
  rate: number;
  rateLabel: string;
  estimatedLoss: number;
  avgDurationSeconds: number;
  topProducts: { title: string; count: number }[];
  topSources: { label: string; count: number }[];
  topHours: { hour: number; count: number }[];
  /** Répartition complète des abandons par heure (24 entrées). */
  hourHistogram: number[];
  topDevice?: string;
  extraMetrics: { label: string; value: string }[];
  probableCauses: string[];
  recommendations: string[];
};

const hasEvent = (s: VisitorSession, name: string) => s.events.some((e) => e.eventName === name);

export function computeAbandonments(dataset: Dataset, period: Period): AbandonmentStats[] {
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);
  const aov = orders.length > 0 ? orders.reduce((a, o) => a + o.totalPrice, 0) / orders.length : 130;

  const pv = sessions.filter((s) => hasEvent(s, "product_viewed"));
  const atc = sessions.filter((s) => hasEvent(s, "product_added_to_cart"));
  const checkout = sessions.filter((s) => hasEvent(s, "checkout_started"));
  const payment = sessions.filter((s) => hasEvent(s, "payment_step_reached"));
  const completed = sessions.filter((s) => hasEvent(s, "checkout_completed"));

  const productAbandons = pv.filter((s) => !hasEvent(s, "product_added_to_cart"));
  const cartAbandons = atc.filter((s) => !hasEvent(s, "checkout_started"));
  const checkoutAbandons = checkout.filter((s) => !hasEvent(s, "payment_step_reached"));
  const paymentAbandons = payment.filter((s) => !hasEvent(s, "checkout_completed"));

  const cartValue = (group: VisitorSession[]) =>
    group.reduce((acc, s) => {
      const sub = s.events.find((e) => typeof e.metadata?.subtotal === "number")?.metadata?.subtotal as number | undefined;
      const price = s.events.find((e) => e.eventName === "payment_step_reached")?.price;
      const atcVal = s.events
        .filter((e) => e.eventName === "product_added_to_cart")
        .reduce((a, e) => a + (e.price ?? 0) * (e.quantity ?? 1), 0);
      return acc + (price ?? sub ?? atcVal ?? 0);
    }, 0);

  return [
    {
      key: "product",
      label: "Abandon produit",
      description: "Produit vu mais aucun ajout au panier.",
      sessions: productAbandons.length,
      rate: pct(atc.length, pv.length),
      rateLabel: "Taux vue → ajout panier",
      estimatedLoss: round2(productAbandons.length * aov * 0.015),
      avgDurationSeconds: avgDuration(productAbandons),
      topProducts: topProducts(productAbandons, "product_viewed"),
      topSources: topSources(productAbandons),
      topHours: topHours(productAbandons),
      hourHistogram: hourHistogram(productAbandons),
      topDevice: topDevice(productAbandons),
      extraMetrics: [
        { label: "Vues produit", value: String(pv.length) },
        { label: "Clics images", value: String(countEvents(productAbandons, "image_clicked")) },
        { label: "Clics avis", value: String(countEvents(productAbandons, "reviews_clicked")) },
        { label: "Clics livraison", value: String(countEvents(productAbandons, "shipping_info_clicked")) },
        { label: "Scroll moyen", value: `${avgScroll(productAbandons)}%` },
      ],
      probableCauses: [
        "Photos produit insuffisantes ou dimensions pas assez claires",
        "Prix perçu trop élevé par rapport à la valeur démontrée",
        "Manque d'avis clients et d'éléments de réassurance",
        "Trafic publicitaire trop large (intention faible)",
      ],
      recommendations: [
        "Prioriser les produits les plus vus avec 0 ajout panier",
        "Ajouter un schéma de dimensions et des photos en situation",
        "Afficher les avis et la politique de livraison au-dessus de la ligne de flottaison",
      ],
    },
    {
      key: "cart",
      label: "Abandon panier",
      description: "Ajout panier sans checkout commencé.",
      sessions: cartAbandons.length,
      rate: pct(checkout.length, atc.length),
      rateLabel: "Taux ajout panier → checkout",
      estimatedLoss: round2(cartValue(cartAbandons) * 0.25),
      avgDurationSeconds: avgDuration(cartAbandons),
      topProducts: topProducts(cartAbandons, "product_added_to_cart"),
      topSources: topSources(cartAbandons),
      topHours: topHours(cartAbandons),
      hourHistogram: hourHistogram(cartAbandons),
      topDevice: topDevice(cartAbandons),
      extraMetrics: [
        { label: "Ajouts panier", value: String(atc.length) },
        { label: "Paniers ouverts", value: String(cartAbandons.filter((s) => hasEvent(s, "cart_viewed")).length) },
        { label: "Valeur abandonnée", value: fmtEUR(cartValue(cartAbandons)) },
      ],
      probableCauses: [
        "Frais ou délais de livraison découverts trop tard",
        "Bouton checkout peu visible ou panier peu rassurant",
        "Attente d'un code promo",
      ],
      recommendations: [
        "Afficher la livraison offerte / les délais dès la page produit",
        "Mettre en place un email panier abandonné sous 2 heures",
      ],
    },
    {
      key: "checkout",
      label: "Abandon checkout",
      description: "Checkout commencé sans atteindre le paiement.",
      sessions: checkoutAbandons.length,
      rate: pct(payment.length, checkout.length),
      rateLabel: "Taux checkout → paiement",
      estimatedLoss: round2(cartValue(checkoutAbandons) * 0.35),
      avgDurationSeconds: avgDuration(checkoutAbandons),
      topProducts: topProducts(checkoutAbandons, "product_added_to_cart"),
      topSources: topSources(checkoutAbandons),
      topHours: topHours(checkoutAbandons),
      hourHistogram: hourHistogram(checkoutAbandons),
      topDevice: topDevice(checkoutAbandons),
      extraMetrics: [
        { label: "Checkouts commencés", value: String(checkout.length) },
        { label: "Coordonnées saisies", value: String(sessions.filter((s) => hasEvent(s, "checkout_contact_info_submitted")).length) },
        { label: "Livraison renseignée", value: String(sessions.filter((s) => hasEvent(s, "checkout_shipping_info_submitted")).length) },
        { label: "Codes promo refusés", value: String(countEvents(sessions, "discount_code_rejected")) },
      ],
      probableCauses: [
        "Frais de livraison affichés à cette étape",
        "Formulaire trop long sur mobile",
        "Code promo refusé (codes expirés en circulation)",
      ],
      recommendations: [
        "Vérifier les codes promo actifs : 2 refus observés sur la période",
        "Activer l'auto-complétion d'adresse",
      ],
    },
    {
      key: "payment",
      label: "Abandon paiement",
      description: "Paiement atteint sans commande confirmée.",
      sessions: paymentAbandons.length,
      rate: pct(completed.length, payment.length),
      rateLabel: "Taux paiement → achat",
      estimatedLoss: round2(cartValue(paymentAbandons) * 0.5),
      avgDurationSeconds: avgDuration(paymentAbandons),
      topProducts: topProducts(paymentAbandons, "product_added_to_cart"),
      topSources: topSources(paymentAbandons),
      topHours: topHours(paymentAbandons),
      hourHistogram: hourHistogram(paymentAbandons),
      topDevice: topDevice(paymentAbandons),
      extraMetrics: [
        { label: "Paiements atteints", value: String(payment.length) },
        { label: "Paiements soumis", value: String(sessions.filter((s) => hasEvent(s, "payment_info_submitted")).length) },
        { label: "Commandes confirmées", value: String(completed.length) },
        { label: "Valeur en jeu", value: fmtEUR(cartValue(paymentAbandons)) },
      ],
      probableCauses: [
        "Hésitation finale : prix total, confiance, sécurité",
        "Moyen de paiement souhaité absent (PayPal, Apple Pay)",
        "Paniers anciens repris puis re-abandonnés (voir paiements hors cohorte)",
      ],
      recommendations: [
        "Ajouter PayPal et Apple Pay si absents",
        "Afficher les badges de sécurité au niveau du bouton payer",
        "Relancer ces sessions : panier connu et email déjà saisi",
      ],
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avgDuration(group: VisitorSession[]): number {
  if (group.length === 0) return 0;
  return Math.round(group.reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / group.length);
}

function countEvents(group: VisitorSession[], name: string): number {
  return group.reduce((a, s) => a + s.events.filter((e) => e.eventName === name).length, 0);
}

function avgScroll(group: VisitorSession[]): number {
  const depths = group.flatMap((s) =>
    s.events
      .filter((e) => e.eventName === "scroll_depth_reached")
      .map((e) => (e.metadata?.depth as number) ?? 0)
  );
  if (depths.length === 0) return 0;
  return Math.round(depths.reduce((a, b) => a + b, 0) / depths.length);
}

function topProducts(group: VisitorSession[], eventName: string): { title: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of group) {
    const seen = new Set<string>();
    for (const e of s.events) {
      if (e.eventName === eventName && e.productTitle && !seen.has(e.productTitle)) {
        seen.add(e.productTitle);
        counts.set(e.productTitle, (counts.get(e.productTitle) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function topSources(group: VisitorSession[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of group) {
    const label = SOURCE_LABELS[classifySource(s.source, s.medium)];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function topHours(group: VisitorSession[]): { hour: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const s of group) {
    const h = new Date(s.startedAt).getHours();
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function hourHistogram(group: VisitorSession[]): number[] {
  const hist = Array.from({ length: 24 }, () => 0);
  for (const s of group) hist[new Date(s.startedAt).getHours()]++;
  return hist;
}

function topDevice(group: VisitorSession[]): string | undefined {
  const counts = new Map<string, number>();
  for (const s of group) counts.set(s.device, (counts.get(s.device) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const labels: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablette" };
  return sorted[0] ? labels[sorted[0][0]] : undefined;
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return round1((num / den) * 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtRate(n: number): string {
  return `${round1(n).toString().replace(".", ",")}%`;
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
