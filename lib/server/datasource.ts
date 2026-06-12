import "server-only";
import { cache } from "react";
import { getDataset as getDemoDataset } from "@/data/dataset";
import { reconcileDataset } from "@/lib/reconciliation";
import type {
  Dataset,
  Device,
  EventStatus,
  Product,
  Shop,
  ShopifyOrder,
  TrackingEvent,
  VisitorSession,
} from "@/lib/types";
import { query, queryOne } from "./db";
import { env, isDatabaseConfigured, isOAuthConfigured } from "./env";
import {
  getConnectedShop,
  getLastSyncRun,
  getShopStats,
  replaceAnomalies,
  type ShopRow,
  type ShopStats,
  type SyncRunRow,
} from "./repo";

/**
 * Source de données unique pour toutes les pages.
 *
 * Règle stricte : jamais de mélange silencieux. Soit la boutique est
 * connectée et TOUTES les données viennent de la base (mode live), soit on
 * est en mode démo et l'interface l'affiche clairement.
 */

export type AppMode = "demo" | "live";

export type AppStatus = {
  mode: AppMode;
  /** Pourquoi on est dans ce mode — affiché tel quel dans l'UI. */
  reason:
    | "connected"
    | "oauth_not_configured"
    | "database_not_configured"
    | "no_shop_connected"
    | "database_error"
    | "token_missing"
    | "demo_forced";
  shopDomain?: string;
  shopName?: string;
  apiStatus?: ShopRow["api_status"];
  apiError?: string | null;
  connectionMethod?: ShopRow["connection_method"];
  apiVersion?: string | null;
  tokenHint?: string | null;
  tokenPresent?: boolean;
  lastApiCheckAt?: string | null;
  dataMode?: ShopRow["data_mode"];
  pixelStatus?: ShopRow["pixel_status"];
  pixelInstalledAt?: string | null;
  installedScopes?: string[];
  missingScopes?: string[];
  webPixelId?: string | null;
  pixelError?: string | null;
  lastSync?: SyncRunRow | null;
  syncRunning?: boolean;
  stats?: ShopStats;
  lastEventAt?: string | null;
};

export const getAppStatus = cache(async (): Promise<AppStatus> => {
  if (!isDatabaseConfigured()) {
    return { mode: "demo", reason: isOAuthConfigured() ? "database_not_configured" : "oauth_not_configured" };
  }

  let shop: ShopRow | null = null;
  try {
    shop = await getConnectedShop();
  } catch (err) {
    console.error("[datasource] Base injoignable :", err instanceof Error ? err.message : err);
    return { mode: "demo", reason: "database_error" };
  }

  if (!shop) {
    return { mode: "demo", reason: isOAuthConfigured() ? "no_shop_connected" : "oauth_not_configured" };
  }

  const [lastSync, stats, tokenRow] = await Promise.all([
    getLastSyncRun(shop.id),
    getShopStats(shop.id),
    queryOne<{ id: string }>("select id from shopify_tokens where shop_id = $1", [shop.id]),
  ]);
  // Pour une connexion par token manuel, les scopes de référence sont
  // ceux du token ; pour l'OAuth, ceux demandés par l'app.
  const requested =
    shop.connection_method === "manual_token"
      ? ["read_products", "read_orders"]
      : env.shopifyScopes.split(",").map((s) => s.trim()).filter(Boolean);
  const installed = (shop.installed_scopes ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Bascule explicite « Revenir au mode démo » : la boutique reste
  // connectée mais l'interface affiche les données de démonstration.
  const mode: AppMode = shop.data_mode === "demo" ? "demo" : "live";

  return {
    mode,
    reason: mode === "demo" ? "demo_forced" : "connected",
    shopDomain: shop.shopify_domain,
    shopName: shop.name ?? shop.shopify_domain,
    apiStatus: shop.api_status,
    apiError: shop.api_error,
    connectionMethod: shop.connection_method,
    apiVersion: shop.api_version,
    tokenHint: shop.token_hint,
    tokenPresent: tokenRow != null,
    lastApiCheckAt: shop.last_api_check_at,
    dataMode: shop.data_mode,
    pixelStatus: shop.pixel_status,
    pixelInstalledAt: shop.pixel_installed_at,
    installedScopes: installed,
    missingScopes: requested.filter((s) => !installed.includes(s)),
    webPixelId: shop.web_pixel_id,
    pixelError: shop.pixel_error,
    lastSync,
    syncRunning: lastSync?.status === "running",
    stats,
    lastEventAt: stats.lastEventAt,
  };
});

export type ActiveData = {
  dataset: Dataset;
  mode: AppMode;
  status: AppStatus;
  /** true si live mais aucune session tracking sur la fenêtre. */
  liveEmpty: boolean;
};

export const getActiveDataset = cache(async (): Promise<ActiveData> => {
  const status = await getAppStatus();
  if (status.mode === "demo") {
    return { dataset: getDemoDataset(), mode: "demo", status, liveEmpty: false };
  }
  try {
    const shop = await getConnectedShop();
    if (!shop) {
      return { dataset: getDemoDataset(), mode: "demo", status: { ...status, mode: "demo", reason: "no_shop_connected" }, liveEmpty: false };
    }
    const dataset = await buildLiveDataset(shop);
    return { dataset, mode: "live", status, liveEmpty: dataset.sessions.length === 0 };
  } catch (err) {
    console.error("[datasource] Lecture live impossible :", err instanceof Error ? err.message : err);
    return {
      dataset: getDemoDataset(),
      mode: "demo",
      status: { ...status, mode: "demo", reason: "database_error" },
      liveEmpty: false,
    };
  }
});

// ─── Construction du Dataset depuis la base ──────────────────────────────────

type SessionRowDb = {
  id: string;
  session_key: string;
  visitor_key: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing_page: string | null;
  referrer: string | null;
  device: string;
  browser: string | null;
  country: string | null;
  status: VisitorSession["status"];
  reliability_score: number;
};

type EventRowDb = {
  id: string;
  session_key: string;
  visitor_key: string;
  event_name: string;
  occurred_at: string;
  page_url: string | null;
  referrer: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  product_title: string | null;
  variant_title: string | null;
  quantity: number | null;
  price: string | null;
  currency: string | null;
  cart_token: string | null;
  checkout_token: string | null;
  order_id: string | null;
  customer_id: string | null;
  status: EventStatus;
  metadata: Record<string, unknown> | null;
};

type OrderRowDb = {
  id: string;
  shopify_order_id: string;
  order_number: string | null;
  created_at_shopify: string;
  cancelled_at: string | null;
  total_price: string;
  currency: string;
  financial_status: string | null;
  cart_token: string | null;
  checkout_token: string | null;
  source_name: string | null;
  referring_site: string | null;
  country: string | null;
  product_ids: string[] | null;
};

async function buildLiveDataset(shop: ShopRow): Promise<Dataset> {
  const shopInfo: Shop = {
    id: shop.id,
    shopifyDomain: shop.shopify_domain,
    name: shop.name ?? shop.shopify_domain,
    currency: shop.currency,
    timezone: shop.timezone,
    connectedAt: shop.connected_at ?? new Date().toISOString(),
    apiStatus: shop.api_status,
    // « installing » est un état transitoire propre au statut serveur ;
    // le type Shop public reste sur les 4 états historiques.
    pixelStatus: shop.pixel_status === "installing" ? "not_installed" : shop.pixel_status,
  };

  // Catalogue — l'id produit exposé est l'ID Shopify pour matcher les
  // product_id envoyés par le pixel.
  const productRows = await query<{
    shopify_product_id: string;
    title: string;
    handle: string | null;
    image_url: string | null;
    vendor: string | null;
    product_type: string | null;
    status: string;
    price_min: string;
    price_max: string;
    cost: string | null;
    stock: number | null;
  }>("select * from products where shop_id = $1", [shop.id]);

  const products: Product[] = productRows.map((p) => ({
    id: p.shopify_product_id,
    shopId: shop.id,
    shopifyProductId: p.shopify_product_id,
    title: p.title,
    handle: p.handle ?? "",
    imageUrl: p.image_url ?? undefined,
    vendor: p.vendor ?? undefined,
    productType: p.product_type ?? undefined,
    status: (["active", "draft", "archived"].includes(p.status) ? p.status : "active") as Product["status"],
    priceMin: Number(p.price_min),
    priceMax: Number(p.price_max),
    cost: p.cost != null ? Number(p.cost) : undefined,
    stock: p.stock ?? undefined,
  }));

  // Sessions des 7 derniers jours + leurs événements
  const sessionRows = await query<SessionRowDb>(
    `select * from visitor_sessions
     where shop_id = $1 and started_at >= now() - interval '7 days'
     order by started_at desc`,
    [shop.id]
  );
  const eventRows = await query<EventRowDb>(
    `select * from tracking_events
     where shop_id = $1 and occurred_at >= now() - interval '8 days'
     order by occurred_at asc`,
    [shop.id]
  );

  // Enrichissement : pour les checkouts repris, retrouver la date de création
  // du panier via le premier add_to_cart portant le même cart_token (30 j).
  const checkoutCartTokens = [
    ...new Set(
      eventRows
        .filter((e) => (e.event_name === "checkout_started" || e.event_name === "payment_step_reached") && e.cart_token)
        .map((e) => e.cart_token!)
    ),
  ];
  const cartCreatedMap = new Map<string, string>();
  if (checkoutCartTokens.length > 0) {
    const rows = await query<{ cart_token: string; first_atc: string }>(
      `select cart_token, min(occurred_at)::text as first_atc
       from tracking_events
       where shop_id = $1 and event_name = 'product_added_to_cart' and cart_token = any($2)
         and occurred_at >= now() - interval '30 days'
       group by cart_token`,
      [shop.id, checkoutCartTokens]
    );
    for (const r of rows) cartCreatedMap.set(r.cart_token, new Date(r.first_atc).toISOString());
  }

  const eventsBySession = new Map<string, TrackingEvent[]>();
  for (const e of eventRows) {
    const cartCreatedAt = e.cart_token ? cartCreatedMap.get(e.cart_token) : undefined;
    const metadata: Record<string, unknown> = { ...(e.metadata ?? {}) };
    if (cartCreatedAt && (e.event_name === "checkout_started" || e.event_name === "payment_step_reached")) {
      metadata.cartCreatedAt = cartCreatedAt;
    }
    if (
      e.event_name === "checkout_started" &&
      !e.cart_token &&
      typeof metadata.cartCreatedAt !== "string"
    ) {
      metadata.cartUnknown = true;
    }
    const event: TrackingEvent = {
      id: e.id,
      shopId: shop.id,
      visitorId: e.visitor_key,
      sessionId: e.session_key,
      eventName: e.event_name,
      timestamp: new Date(e.occurred_at).toISOString(),
      pageUrl: e.page_url ?? undefined,
      referrer: e.referrer ?? undefined,
      source: e.source ?? undefined,
      medium: e.medium ?? undefined,
      campaign: e.campaign ?? undefined,
      content: e.content ?? undefined,
      term: e.term ?? undefined,
      device: (e.device as Device | null) ?? undefined,
      browser: e.browser ?? undefined,
      country: e.country ?? undefined,
      productId: e.product_id ?? undefined,
      variantId: e.variant_id ?? undefined,
      sku: e.sku ?? undefined,
      productTitle: e.product_title ?? undefined,
      variantTitle: e.variant_title ?? undefined,
      quantity: e.quantity ?? undefined,
      price: e.price != null ? Number(e.price) : undefined,
      currency: e.currency ?? undefined,
      cartToken: e.cart_token ?? undefined,
      checkoutToken: e.checkout_token ?? undefined,
      orderId: e.order_id ?? undefined,
      customerId: e.customer_id ?? undefined,
      status: e.status,
      metadata,
    };
    const list = eventsBySession.get(e.session_key) ?? [];
    list.push(event);
    eventsBySession.set(e.session_key, list);
  }

  const sessions: VisitorSession[] = sessionRows.map((s) => {
    const events = eventsBySession.get(s.session_key) ?? [];
    return {
      id: s.session_key,
      shopId: shop.id,
      visitorId: s.visitor_key,
      startedAt: new Date(s.started_at).toISOString(),
      endedAt: s.ended_at ? new Date(s.ended_at).toISOString() : undefined,
      durationSeconds: s.duration_seconds ?? undefined,
      source: s.source ?? undefined,
      medium: s.medium ?? undefined,
      campaign: s.campaign ?? undefined,
      landingPage: s.landing_page ?? "/",
      device: (["mobile", "desktop", "tablet"].includes(s.device) ? s.device : "desktop") as Device,
      browser: s.browser ?? undefined,
      country: s.country ?? undefined,
      status: s.status,
      reliabilityScore: s.reliability_score,
      events,
    };
  });

  // Commandes 30 jours + produits par commande (agrégés depuis les lignes)
  const orderRows = await query<OrderRowDb>(
    `select o.*,
       (select array_agg(distinct li.shopify_product_id)
        from order_line_items li
        where li.order_id = o.id and li.shopify_product_id is not null) as product_ids
     from orders o
     where o.shop_id = $1 and o.created_at_shopify >= now() - interval '30 days'
       and o.cancelled_at is null
     order by o.created_at_shopify asc`,
    [shop.id]
  );

  // Rattachement commande → session : order_id, puis checkout_token, puis cart_token
  const sessionByOrderId = new Map<string, VisitorSession>();
  const sessionByCheckoutToken = new Map<string, VisitorSession>();
  const sessionByCartToken = new Map<string, VisitorSession>();
  for (const s of sessions) {
    for (const e of s.events) {
      if (e.orderId) sessionByOrderId.set(e.orderId, s);
      if (e.checkoutToken) sessionByCheckoutToken.set(e.checkoutToken, s);
      if (e.cartToken) sessionByCartToken.set(e.cartToken, s);
    }
  }

  const orders: ShopifyOrder[] = orderRows.map((o) => {
    const linked =
      sessionByOrderId.get(o.shopify_order_id) ??
      (o.checkout_token ? sessionByCheckoutToken.get(o.checkout_token) : undefined) ??
      (o.cart_token ? sessionByCartToken.get(o.cart_token) : undefined);
    return {
      id: o.shopify_order_id,
      shopId: shop.id,
      orderNumber: o.order_number ?? `#${o.shopify_order_id}`,
      createdAt: new Date(o.created_at_shopify).toISOString(),
      totalPrice: Number(o.total_price),
      currency: o.currency,
      financialStatus: (o.financial_status === "refunded"
        ? "refunded"
        : o.financial_status === "paid"
          ? "paid"
          : "pending") as ShopifyOrder["financialStatus"],
      cartToken: o.cart_token ?? undefined,
      checkoutToken: o.checkout_token ?? undefined,
      sessionId: linked?.id,
      visitorId: linked?.visitorId,
      source: linked?.source,
      productIds: o.product_ids ?? [],
      country: o.country ?? undefined,
    };
  });

  // Aligne les orderId des événements checkout_completed sur l'ID commande
  // Shopify pour que la règle 1 (confirmation) s'applique.
  for (const s of sessions) {
    for (const e of s.events) {
      if (e.eventName === "checkout_completed" && !e.orderId && e.checkoutToken) {
        const order = orders.find((o) => o.checkoutToken === e.checkoutToken);
        if (order) e.orderId = order.id;
      }
    }
  }

  // Réconciliation : même moteur que le mode démo, sur données serveur.
  const anomalies = reconcileDataset(sessions, orders, shop.id);

  // Statut de session dérivé des événements réconciliés
  for (const s of sessions) {
    const confirmed = s.events.some((e) => e.eventName === "checkout_completed" && e.status === "confirmed");
    const incompleteCheckout = s.events.some((e) => e.eventName === "checkout_started" && e.status === "incomplete");
    if (confirmed) s.status = "converted";
    else if (incompleteCheckout) s.status = "incomplete";
    else if (s.status === "active" && s.endedAt && Date.now() - new Date(s.endedAt).getTime() > 30 * 60 * 1000) {
      s.status = "abandoned";
    }
  }

  // Instantané des anomalies en base (best effort, non bloquant)
  replaceAnomalies(shop.id, anomalies).catch((err) =>
    console.error("[datasource] Persistance des anomalies impossible :", err instanceof Error ? err.message : err)
  );

  return { shop: shopInfo, products, sessions, orders, anomalies };
}
