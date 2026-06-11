import type { Dataset, ShopifyOrder, TrackingEvent, VisitorSession, Device } from "@/lib/types";
import { at, mulberry32, pad, pickWeighted } from "@/lib/utils";
import { heroSessions } from "./heroSessions";
import { products } from "./products";
import { shop } from "./shop";
import { reconcileDataset } from "@/lib/reconciliation";

const shopId = shop.id;

/**
 * Jeu de données de démonstration, généré de façon déterministe (seed fixe)
 * pour être stable entre les rendus.
 *
 * Aujourd'hui correspond exactement au scénario problème :
 *   155 sessions · 84 vues produit · 2 ajouts panier · 5 paiements atteints
 *   · 1 commande confirmée — dont 4 paiements hors cohorte.
 *
 * Les 6 jours précédents sont générés avec des parcours cohérents pour
 * alimenter les analyses 7 jours (produits, sources, abandons).
 */

// ─── Référentiels du générateur ───────────────────────────────────────────────

type SourceDef = {
  source?: string;
  medium?: string;
  campaigns?: string[];
  referrer?: string;
  weight: number;
};

const SOURCES: SourceDef[] = [
  { source: "google", medium: "cpc", campaigns: ["pmax-lustres", "pmax-large", "search-marque"], referrer: "https://www.google.com", weight: 28 },
  { source: "facebook", medium: "paid", campaigns: ["lustres-video-1", "plafonniers-carrousel", "retargeting-panier"], referrer: "https://m.facebook.com", weight: 20 },
  { source: "tiktok", medium: "paid", campaigns: ["deco-chambre-ugc"], referrer: "https://www.tiktok.com", weight: 7 },
  { source: "google", medium: "organic", referrer: "https://www.google.com", weight: 14 },
  { source: "direct", medium: undefined, referrer: undefined, weight: 13 },
  { source: "klaviyo", medium: "email", campaigns: ["newsletter-juin"], referrer: "email", weight: 4 },
  { source: "pinterest", medium: "referral", referrer: "https://www.pinterest.fr", weight: 5 },
  { source: undefined, medium: undefined, referrer: undefined, weight: 9 },
];

const PRODUCT_VIEW_WEIGHTS: [string, number][] = [
  ["p2", 27], // Suspension Verre Fumé — beaucoup de vues, très peu d'ajouts (cas d'école)
  ["p1", 22],
  ["p3", 16],
  ["p6", 14],
  ["p4", 12],
  ["p5", 9],
];

// Pour les conversions générées (jours passés), le verre fumé convertit mal.
const PRODUCT_CONVERSION_WEIGHTS: [string, number][] = [
  ["p1", 30],
  ["p3", 24],
  ["p4", 16],
  ["p6", 16],
  ["p5", 10],
  ["p2", 4],
];

const DEVICES: [Device, number][] = [
  ["mobile", 62],
  ["desktop", 33],
  ["tablet", 5],
];

const COUNTRIES: [string, number][] = [
  ["FR", 78],
  ["BE", 10],
  ["CH", 6],
  ["CA", 4],
  ["LU", 2],
];

const HOURS: [number, number][] = [
  [8, 3], [9, 5], [10, 7], [11, 8], [12, 7], [13, 7], [14, 8], [15, 7],
  [16, 6], [17, 7], [18, 8], [19, 9], [20, 10], [21, 9], [22, 6], [23, 3],
];

const BROWSERS: Record<Device, string[]> = {
  mobile: ["Safari iOS", "Chrome Android", "Samsung Internet", "Instagram in-app"],
  desktop: ["Chrome", "Safari", "Firefox", "Edge"],
  tablet: ["Safari iPadOS", "Chrome Android"],
};

const SEARCH_TERMS = ["suspension salon", "lustre doré", "plafonnier chambre", "lampe chevet", "applique noire", "suspension rotin"];

// ─── Construction d'une session générée ──────────────────────────────────────

type GenOptions = {
  dayOffset: number;
  index: number;
  rng: () => number;
  /** Étape maximale atteinte par la session. */
  reach: "bounce" | "browse" | "product" | "cart" | "checkout" | "payment" | "order";
  forceMissingUtm?: boolean;
  forceDuplicate?: boolean;
};

let orderSeq = 900;

function generateSession(opts: GenOptions): VisitorSession {
  const { dayOffset, index, rng, reach } = opts;
  const id = `ses_d${dayOffset}_${pad(index, 3)}`;
  const visitorId = `vis_d${dayOffset}_${pad(index, 3)}`;

  const src = opts.forceMissingUtm
    ? { source: undefined, medium: undefined, referrer: "https://m.facebook.com", weight: 0 }
    : pickWeighted(rng, SOURCES.map((s) => [s, s.weight] as [SourceDef, number]));
  const campaign = src.campaigns ? src.campaigns[Math.floor(rng() * src.campaigns.length)] : undefined;
  const device = pickWeighted(rng, DEVICES);
  const country = pickWeighted(rng, COUNTRIES);
  const browser = BROWSERS[device][Math.floor(rng() * BROWSERS[device].length)];
  const hour = pickWeighted(rng, HOURS);
  const min = Math.floor(rng() * 60);
  const sec = Math.floor(rng() * 60);

  let t = new Date(at(dayOffset, `${pad(hour)}:${pad(min)}:${pad(sec)}`)).getTime();
  const ts = () => new Date(t).toISOString();
  const step = (minS: number, maxS: number) => {
    t += Math.round((minS + rng() * (maxS - minS)) * 1000);
  };

  const events: TrackingEvent[] = [];
  let evSeq = 0;
  const push = (e: Partial<TrackingEvent> & { eventName: string }) => {
    events.push({
      id: `${id}_e${++evSeq}`,
      shopId,
      visitorId,
      sessionId: id,
      timestamp: ts(),
      device,
      country,
      browser,
      source: src.source,
      medium: src.medium,
      campaign,
      currency: "EUR",
      status: "observed",
      ...e,
    });
  };

  const productId = reach === "bounce" || reach === "browse"
    ? undefined
    : pickWeighted(rng, ["cart", "checkout", "payment", "order"].includes(reach) ? PRODUCT_CONVERSION_WEIGHTS : PRODUCT_VIEW_WEIGHTS);
  const product = productId ? products.find((p) => p.id === productId)! : undefined;
  const qty = reach === "order" && rng() < 0.2 ? 2 : 1;

  const landingPage = product
    ? rng() < 0.55
      ? `/products/${product.handle}`
      : "/collections/all"
    : rng() < 0.5
      ? "/"
      : "/collections/suspensions";

  push({ eventName: "session_started", pageUrl: landingPage, referrer: src.referrer, metadata: opts.forceMissingUtm ? { suspectedPaid: true } : undefined });
  if (src.medium === "cpc" || src.medium === "paid" || src.medium === "email") {
    push({ eventName: "utm_detected", metadata: { utm_source: src.source, utm_medium: src.medium, utm_campaign: campaign } });
  } else if (src.referrer) {
    push({ eventName: "referrer_detected", referrer: src.referrer, status: opts.forceMissingUtm ? "suspect" : "observed", metadata: opts.forceMissingUtm ? { note: "Trafic payé probable sans UTM" } : undefined });
  }
  step(1, 3);
  push({ eventName: "page_viewed", pageUrl: landingPage });

  if (reach === "bounce") {
    return finalize();
  }

  if (!landingPage.startsWith("/products/") && reach !== "browse") {
    step(8, 40);
    if (rng() < 0.3) {
      push({ eventName: "search_submitted", term: SEARCH_TERMS[Math.floor(rng() * SEARCH_TERMS.length)], pageUrl: "/search" });
      step(4, 15);
    } else {
      push({ eventName: "collection_viewed", pageUrl: "/collections/suspensions", metadata: { collection: "Suspensions" } });
      step(6, 25);
    }
  }

  if (reach === "browse") {
    step(10, 50);
    push({ eventName: "collection_viewed", pageUrl: "/collections/all", metadata: { collection: "Tous les produits" } });
    if (rng() < 0.4) {
      step(5, 30);
      push({ eventName: "scroll_depth_reached", metadata: { depth: 50 } });
    }
    return finalize();
  }

  // Vue produit
  step(3, 12);
  push({ eventName: "product_viewed", productId: product!.id, productTitle: product!.title, price: product!.priceMin, pageUrl: `/products/${product!.handle}` });
  if (opts.forceDuplicate) {
    t += 900; // doublon quasi simultané (double déclenchement du pixel)
    push({ eventName: "product_viewed", productId: product!.id, productTitle: product!.title, price: product!.priceMin, pageUrl: `/products/${product!.handle}` });
  }
  if (rng() < 0.45) {
    step(8, 35);
    push({ eventName: "image_clicked", productId: product!.id, productTitle: product!.title });
  }
  if (rng() < 0.5) {
    step(10, 40);
    push({ eventName: "scroll_depth_reached", productId: product!.id, metadata: { depth: rng() < 0.5 ? 50 : 75 } });
  }
  if (rng() < 0.18) {
    step(5, 25);
    push({ eventName: "reviews_clicked", productId: product!.id, productTitle: product!.title });
  }

  if (reach === "product") {
    return finalize();
  }

  // Ajout panier
  const cartToken = `crt_${id.slice(4)}`;
  step(15, 70);
  push({ eventName: "variant_selected", productId: product!.id, productTitle: product!.title, price: product!.priceMin });
  step(5, 30);
  push({ eventName: "product_added_to_cart", productId: product!.id, productTitle: product!.title, quantity: qty, price: product!.priceMin, cartToken });
  const cartCreatedAt = ts();
  step(5, 20);
  push({ eventName: "cart_viewed", cartToken, metadata: { subtotal: product!.priceMin * qty } });

  if (reach === "cart") {
    return finalize();
  }

  // Checkout
  const checkoutToken = `chk_${id.slice(4)}`;
  step(10, 45);
  push({ eventName: "checkout_started", cartToken, checkoutToken, metadata: { cartCreatedAt } });
  step(25, 80);
  push({ eventName: "checkout_contact_info_submitted", checkoutToken, metadata: { emailProvided: true } });
  step(20, 70);
  push({ eventName: "checkout_shipping_info_submitted", checkoutToken });

  if (reach === "checkout") {
    return finalize();
  }

  step(10, 35);
  push({ eventName: "checkout_shipping_method_selected", checkoutToken });
  step(10, 40);
  push({ eventName: "payment_step_reached", checkoutToken, price: product!.priceMin * qty });

  if (reach === "payment") {
    return finalize();
  }

  // Commande
  const orderId = `ord_${++orderSeq}`;
  step(40, 110);
  push({ eventName: "payment_info_submitted", checkoutToken });
  step(5, 20);
  push({ eventName: "checkout_completed", checkoutToken, orderId, price: product!.priceMin * qty });
  push({ eventName: "order_created", orderId, price: product!.priceMin * qty, status: "confirmed" });
  step(20, 90);
  push({ eventName: "order_paid", orderId, price: product!.priceMin * qty, status: "confirmed" });

  return finalize();

  function finalize(): VisitorSession {
    const startedAt = events[0].timestamp;
    const endedAt = events[events.length - 1].timestamp;
    const duration = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    return {
      id,
      shopId,
      visitorId,
      startedAt,
      endedAt,
      durationSeconds: duration,
      source: src.source,
      medium: src.medium,
      campaign,
      landingPage,
      device,
      browser,
      country,
      status: reach === "order" ? "converted" : opts.forceDuplicate ? "suspect" : "abandoned",
      reliabilityScore: opts.forceMissingUtm ? 64 : opts.forceDuplicate ? 70 : 85 + Math.round(rng() * 14),
      events,
    };
  }
}

// ─── Jour J : 144 sessions de remplissage (aucune conversion supplémentaire) ─

function generateToday(): VisitorSession[] {
  const rng = mulberry32(42);
  const sessions: VisitorSession[] = [];
  // 80 sessions avec vue produit + 64 sans → avec les 11 sessions héros du
  // jour (dont 4 avec vue produit), on obtient 155 sessions et 84 vues produit.
  for (let i = 0; i < 144; i++) {
    const withProduct = i < 80;
    sessions.push(
      generateSession({
        dayOffset: 0,
        index: i + 1,
        rng,
        reach: withProduct ? "product" : rng() < 0.55 ? "bounce" : "browse",
        forceMissingUtm: i >= 80 && i < 83, // 3 sessions au référent payé sans UTM
        forceDuplicate: i === 12, // 1 session avec événement doublon
      })
    );
  }
  return sessions;
}

// ─── Jours passés : parcours complets et cohérents ───────────────────────────

function generatePastDays(): VisitorSession[] {
  const sessions: VisitorSession[] = [];
  for (let offset = 1; offset <= 6; offset++) {
    const rng = mulberry32(1000 + offset);
    const total = 118 + Math.floor(rng() * 70);
    const orders = Math.max(1, Math.round(total * 0.013));
    const payments = orders + Math.max(1, Math.round(total * 0.008));
    const checkouts = payments + Math.max(1, Math.round(total * 0.009));
    const carts = checkouts + Math.max(2, Math.round(total * 0.022));
    const productViews = Math.round(total * 0.56);

    for (let i = 0; i < total; i++) {
      let reach: GenOptions["reach"];
      if (i < orders) reach = "order";
      else if (i < payments) reach = "payment";
      else if (i < checkouts) reach = "checkout";
      else if (i < carts) reach = "cart";
      else if (i < productViews) reach = "product";
      else reach = rng() < 0.5 ? "bounce" : "browse";

      sessions.push(
        generateSession({
          dayOffset: offset,
          index: i + 1,
          rng,
          reach,
          forceMissingUtm: i === carts + 2, // un peu de trafic payé sans UTM chaque jour
        })
      );
    }
  }
  return sessions;
}

// ─── Commandes Shopify (source de vérité) ────────────────────────────────────

function buildOrders(sessions: VisitorSession[]): ShopifyOrder[] {
  const orders: ShopifyOrder[] = [];
  for (const s of sessions) {
    const completed = s.events.find((e) => e.eventName === "checkout_completed");
    if (!completed?.orderId) continue;
    const atcIds = s.events
      .filter((e) => e.eventName === "product_added_to_cart")
      .map((e) => e.productId)
      .filter((p): p is string => !!p);
    const viewedIds = s.events
      .filter((e) => e.eventName === "product_viewed")
      .map((e) => e.productId)
      .filter((p): p is string => !!p);
    const productIds = [...new Set(atcIds.length > 0 ? atcIds : viewedIds)];
    orders.push({
      id: completed.orderId,
      shopId,
      orderNumber: "",
      createdAt: completed.timestamp,
      totalPrice: completed.price ?? 0,
      currency: "EUR",
      financialStatus: "paid",
      cartToken: s.events.find((e) => e.cartToken)?.cartToken,
      checkoutToken: completed.checkoutToken,
      sessionId: s.id,
      visitorId: s.visitorId,
      source: s.source,
      productIds,
      country: s.country,
    });
  }

  // Commande orpheline : existe dans Shopify, aucune session pixel associée
  // (tracking bloqué côté client — consentement refusé ou bloqueur de pub).
  orders.push({
    id: "ord_0987",
    shopId,
    orderNumber: "",
    createdAt: at(1, "11:26:48"),
    totalPrice: 129.0,
    currency: "EUR",
    financialStatus: "paid",
    sessionId: undefined,
    visitorId: undefined,
    source: undefined,
    productIds: ["p2"],
    country: "FR",
  });

  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((o, i) => (o.orderNumber = `#${2310 + i}`));
  return orders;
}

// ─── Assemblage + cache ──────────────────────────────────────────────────────

let cache: Dataset | null = null;
let cacheDay: string | null = null;

export function getDataset(): Dataset {
  const today = new Date().toDateString();
  if (cache && cacheDay === today) return cache;

  orderSeq = 900;
  const sessions = [...heroSessions, ...generateToday(), ...generatePastDays()];
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const orders = buildOrders(sessions);
  const anomalies = reconcileDataset(sessions, orders);

  cache = { shop, products, sessions, orders, anomalies };
  cacheDay = today;
  return cache;
}
