import "server-only";
import { query, queryOne } from "./db";
import { decryptSecret, encryptSecret, maskEmail } from "./crypto";
import { shopifyIdToNumeric, type OAuthCredentials } from "./shopify";
import { env } from "./env";

/** Lignes typées des tables principales. */

export type ShopRow = {
  id: string;
  shopify_domain: string;
  name: string | null;
  currency: string;
  timezone: string;
  is_demo: boolean;
  api_status: "connected" | "disconnected" | "error" | "demo";
  pixel_status: "installed" | "not_installed" | "installing" | "error" | "demo";
  web_pixel_id: string | null;
  pixel_error: string | null;
  pixel_installed_at: string | null;
  installed_scopes: string | null;
  connected_at: string | null;
  uninstalled_at: string | null;
  connection_method: "oauth" | "manual_token";
  api_version: string | null;
  token_hint: string | null;
  api_error: string | null;
  last_api_check_at: string | null;
  data_mode: "live" | "demo";
};

export type SyncRunRow = {
  id: string;
  shop_id: string;
  status: "running" | "success" | "error";
  range_days: number;
  started_at: string;
  finished_at: string | null;
  products_synced: number;
  variants_synced: number;
  orders_synced: number;
  line_items_synced: number;
  refunds_synced: number;
  customers_synced: number;
  error_message: string | null;
};

// ─── Configuration OAuth « Dev Dashboard » (Client ID + Secret saisis dans l'UI) ─

/**
 * Enregistre (ou met à jour) les identifiants OAuth d'une app du nouveau
 * Shopify Dev Dashboard. Le secret est chiffré AES-256-GCM — jamais en clair.
 */
export async function saveOAuthAppConfig(input: {
  clientId: string;
  clientSecret: string;
  scopes: string;
  appUrl: string;
}): Promise<void> {
  await query(
    `insert into shopify_oauth_config (id, client_id, encrypted_client_secret, scopes, app_url, updated_at)
     values ('singleton', $1, $2, $3, $4, now())
     on conflict (id) do update set
       client_id = excluded.client_id,
       encrypted_client_secret = excluded.encrypted_client_secret,
       scopes = excluded.scopes,
       app_url = excluded.app_url,
       updated_at = now()`,
    [input.clientId, encryptSecret(input.clientSecret), input.scopes, input.appUrl.replace(/\/$/, "")]
  );
}

/** Identifiants OAuth complets (secret déchiffré). Usage serveur uniquement. */
export async function getOAuthAppConfig(): Promise<OAuthCredentials | null> {
  const row = await queryOne<{
    client_id: string;
    encrypted_client_secret: string;
    scopes: string;
    app_url: string;
  }>("select client_id, encrypted_client_secret, scopes, app_url from shopify_oauth_config where id = 'singleton'");
  if (!row) return null;
  try {
    return {
      clientId: row.client_id,
      clientSecret: decryptSecret(row.encrypted_client_secret),
      scopes: row.scopes,
      appUrl: row.app_url,
    };
  } catch {
    return null;
  }
}

/** Vue publique (jamais le secret) pour pré-remplir l'interface. */
export async function getOAuthAppConfigPublic(): Promise<{
  clientId: string;
  scopes: string;
  appUrl: string;
} | null> {
  const row = await queryOne<{ client_id: string; scopes: string; app_url: string }>(
    "select client_id, scopes, app_url from shopify_oauth_config where id = 'singleton'"
  );
  if (!row) return null;
  return { clientId: row.client_id, scopes: row.scopes, appUrl: row.app_url };
}

/**
 * Identifiants OAuth effectifs : la config Dev Dashboard saisie dans l'UI
 * (base) prime, sinon repli sur les variables d'environnement de l'app Partner.
 * Retourne null si aucune des deux sources n'est complète.
 */
export async function resolveOAuthCredentials(): Promise<OAuthCredentials | null> {
  try {
    const cfg = await getOAuthAppConfig();
    if (cfg && cfg.clientId && cfg.clientSecret && cfg.appUrl) return cfg;
  } catch {
    // base injoignable : on tente le repli env ci-dessous
  }
  if (env.shopifyApiKey && env.shopifyApiSecret && env.shopifyAppUrl) {
    return {
      clientId: env.shopifyApiKey,
      clientSecret: env.shopifyApiSecret,
      scopes: env.shopifyScopes,
      appUrl: env.shopifyAppUrl,
    };
  }
  return null;
}

// ─── Boutiques & tokens ───────────────────────────────────────────────────────

export async function getShopByDomain(domain: string): Promise<ShopRow | null> {
  return queryOne<ShopRow>("select * from shops where shopify_domain = $1", [domain]);
}

/**
 * Boutique live active (V1 mono-boutique : la dernière connectée).
 * Inclut les boutiques en erreur API : leurs données synchronisées restent
 * valides et l'interface affiche « Connexion invalide » plutôt que de
 * retomber silencieusement en démo.
 */
export async function getConnectedShop(): Promise<ShopRow | null> {
  return queryOne<ShopRow>(
    `select * from shops
     where api_status in ('connected', 'error') and is_demo = false
     order by connected_at desc nulls last limit 1`
  );
}

export async function upsertConnectedShop(input: {
  domain: string;
  name?: string;
  currency?: string;
  timezone?: string;
  scopes: string;
  accessToken: string;
}): Promise<ShopRow> {
  const shop = await queryOne<ShopRow>(
    `insert into shops (shopify_domain, name, currency, timezone, api_status, installed_scopes,
        connected_at, uninstalled_at, connection_method, api_error, last_api_check_at, data_mode, updated_at)
     values ($1, $2, coalesce($3, 'EUR'), coalesce($4, 'Europe/Paris'), 'connected', $5,
        now(), null, 'oauth', null, now(), 'live', now())
     on conflict (shopify_domain) do update set
       name = coalesce(excluded.name, shops.name),
       currency = coalesce($3, shops.currency),
       timezone = coalesce($4, shops.timezone),
       api_status = 'connected',
       installed_scopes = excluded.installed_scopes,
       connected_at = now(),
       uninstalled_at = null,
       connection_method = 'oauth',
       api_error = null,
       last_api_check_at = now(),
       data_mode = 'live',
       updated_at = now()
     returning *`,
    [input.domain, input.name ?? null, input.currency ?? null, input.timezone ?? null, input.scopes]
  );
  await query(
    `insert into shopify_tokens (shop_id, encrypted_token, scopes, updated_at)
     values ($1, $2, $3, now())
     on conflict (shop_id) do update set
       encrypted_token = excluded.encrypted_token,
       scopes = excluded.scopes,
       updated_at = now()`,
    [shop!.id, encryptSecret(input.accessToken), input.scopes]
  );
  return shop!;
}

export async function getAccessToken(shopId: string): Promise<string | null> {
  const row = await queryOne<{ encrypted_token: string }>(
    "select encrypted_token from shopify_tokens where shop_id = $1",
    [shopId]
  );
  if (!row) return null;
  try {
    return decryptSecret(row.encrypted_token);
  } catch {
    return null;
  }
}

export async function markShopUninstalled(domain: string): Promise<void> {
  const shop = await getShopByDomain(domain);
  if (!shop) return;
  await query(
    `update shops set api_status = 'disconnected', pixel_status = 'not_installed',
       uninstalled_at = now(), updated_at = now() where id = $1`,
    [shop.id]
  );
  // Le token devient inutilisable après désinstallation : on le supprime.
  await query("delete from shopify_tokens where shop_id = $1", [shop.id]);
}

export async function setPixelStatus(shopId: string, status: ShopRow["pixel_status"]): Promise<void> {
  await query("update shops set pixel_status = $2, updated_at = now() where id = $1", [shopId, status]);
}

// ─── Sync runs ────────────────────────────────────────────────────────────────

export async function createSyncRun(shopId: string, rangeDays: number): Promise<string> {
  const row = await queryOne<{ id: string }>(
    "insert into sync_runs (shop_id, range_days) values ($1, $2) returning id",
    [shopId, rangeDays]
  );
  return row!.id;
}

export async function finishSyncRun(
  id: string,
  result: {
    status: "success" | "error";
    counts?: Partial<
      Pick<
        SyncRunRow,
        "products_synced" | "variants_synced" | "orders_synced" | "line_items_synced" | "refunds_synced" | "customers_synced"
      >
    >;
    errorMessage?: string;
  }
): Promise<void> {
  const c = result.counts ?? {};
  await query(
    `update sync_runs set status = $2, finished_at = now(), updated_at = now(),
       products_synced = coalesce($3, products_synced),
       variants_synced = coalesce($4, variants_synced),
       orders_synced = coalesce($5, orders_synced),
       line_items_synced = coalesce($6, line_items_synced),
       refunds_synced = coalesce($7, refunds_synced),
       customers_synced = coalesce($8, customers_synced),
       error_message = $9
     where id = $1`,
    [
      id,
      result.status,
      c.products_synced ?? null,
      c.variants_synced ?? null,
      c.orders_synced ?? null,
      c.line_items_synced ?? null,
      c.refunds_synced ?? null,
      c.customers_synced ?? null,
      result.errorMessage ?? null,
    ]
  );
}

export async function getLastSyncRun(shopId: string): Promise<SyncRunRow | null> {
  return queryOne<SyncRunRow>(
    "select * from sync_runs where shop_id = $1 order by started_at desc limit 1",
    [shopId]
  );
}

// ─── Upserts catalogue / commandes (utilisés par la sync et les webhooks) ────

export type NormalizedProduct = {
  shopifyProductId: string;
  title: string;
  handle?: string;
  vendor?: string;
  productType?: string;
  status: string;
  imageUrl?: string;
  tags?: string;
  priceMin: number;
  priceMax: number;
  cost?: number;
  stock?: number;
  variants: {
    shopifyVariantId: string;
    title?: string;
    sku?: string;
    price?: number;
    compareAtPrice?: number;
    inventoryQuantity?: number;
    cost?: number;
  }[];
};

export async function upsertProduct(shopId: string, p: NormalizedProduct): Promise<number> {
  const row = await queryOne<{ id: string }>(
    `insert into products (shop_id, shopify_product_id, title, handle, vendor, product_type, status, image_url, price_min, price_max, cost, stock, tags, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     on conflict (shop_id, shopify_product_id) do update set
       title = excluded.title, handle = excluded.handle, vendor = excluded.vendor,
       product_type = excluded.product_type, status = excluded.status, image_url = excluded.image_url,
       price_min = excluded.price_min, price_max = excluded.price_max,
       cost = excluded.cost, stock = excluded.stock, tags = excluded.tags, updated_at = now()
     returning id`,
    [
      shopId,
      p.shopifyProductId,
      p.title,
      p.handle ?? null,
      p.vendor ?? null,
      p.productType ?? null,
      p.status,
      p.imageUrl ?? null,
      p.priceMin,
      p.priceMax,
      p.cost ?? null,
      p.stock ?? null,
      p.tags ?? null,
    ]
  );
  let variants = 0;
  for (const v of p.variants) {
    await query(
      `insert into product_variants (shop_id, product_id, shopify_variant_id, title, sku, price, compare_at_price, inventory_quantity, cost, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       on conflict (shop_id, shopify_variant_id) do update set
         title = excluded.title, sku = excluded.sku, price = excluded.price,
         compare_at_price = excluded.compare_at_price,
         inventory_quantity = excluded.inventory_quantity, cost = excluded.cost, updated_at = now()`,
      [
        shopId,
        row!.id,
        v.shopifyVariantId,
        v.title ?? null,
        v.sku ?? null,
        v.price ?? null,
        v.compareAtPrice ?? null,
        v.inventoryQuantity ?? null,
        v.cost ?? null,
      ]
    );
    variants++;
  }
  return variants;
}

/** Payload commande au format REST/webhook Shopify (sous-ensemble utilisé). */
export type ShopifyOrderPayload = {
  id: number | string;
  name?: string;
  order_number?: number;
  created_at?: string;
  processed_at?: string | null;
  cancelled_at?: string | null;
  total_price?: string | number;
  subtotal_price?: string | number;
  total_discounts?: string | number;
  total_tax?: string | number;
  total_shipping_price_set?: { shop_money?: { amount?: string | number } } | null;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  cart_token?: string | null;
  checkout_token?: string | null;
  source_name?: string | null;
  referring_site?: string | null;
  landing_site?: string | null;
  customer?: {
    id?: number | string;
    email?: string | null;
    orders_count?: number;
    total_spent?: string;
    default_address?: { country_code?: string | null } | null;
  } | null;
  shipping_address?: { country_code?: string | null } | null;
  line_items?: {
    id: number | string;
    product_id?: number | string | null;
    variant_id?: number | string | null;
    title?: string;
    sku?: string | null;
    quantity?: number;
    price?: string | number;
  }[];
  refunds?: {
    id: number | string;
    created_at?: string;
    note?: string | null;
    transactions?: { amount?: string | number; currency?: string }[];
  }[];
};

export async function upsertOrderFromPayload(
  shopId: string,
  payload: ShopifyOrderPayload
): Promise<{ lineItems: number; refunds: number }> {
  // Client (email masqué dès l'ingestion)
  let customerId: string | null = null;
  if (payload.customer?.id != null) {
    const row = await queryOne<{ id: string }>(
      `insert into customers (shop_id, shopify_customer_id, email_masked, country, orders_count, total_spent, updated_at)
       values ($1,$2,$3,$4,$5,$6, now())
       on conflict (shop_id, shopify_customer_id) do update set
         email_masked = coalesce(excluded.email_masked, customers.email_masked),
         country = coalesce(excluded.country, customers.country),
         orders_count = excluded.orders_count, total_spent = excluded.total_spent, updated_at = now()
       returning id`,
      [
        shopId,
        shopifyIdToNumeric(payload.customer.id),
        maskEmail(payload.customer.email),
        payload.customer.default_address?.country_code ?? null,
        payload.customer.orders_count ?? 0,
        Number(payload.customer.total_spent ?? 0),
      ]
    );
    customerId = row!.id;
  }

  const order = await queryOne<{ id: string }>(
    `insert into orders (shop_id, shopify_order_id, order_number, created_at_shopify, processed_at, cancelled_at,
        total_price, currency, financial_status, fulfillment_status, cart_token, checkout_token, customer_id,
        source_name, referring_site, landing_site, country,
        subtotal_price, total_discounts, total_tax, total_shipping, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$17,$10,$11,$12,$13,$14,$15,$16,$18,$19,$20,$21, now())
     on conflict (shop_id, shopify_order_id) do update set
       order_number = excluded.order_number, processed_at = excluded.processed_at,
       cancelled_at = excluded.cancelled_at, total_price = excluded.total_price,
       financial_status = excluded.financial_status,
       fulfillment_status = excluded.fulfillment_status,
       subtotal_price = excluded.subtotal_price,
       total_discounts = excluded.total_discounts,
       total_tax = excluded.total_tax,
       total_shipping = excluded.total_shipping,
       cart_token = coalesce(excluded.cart_token, orders.cart_token),
       checkout_token = coalesce(excluded.checkout_token, orders.checkout_token),
       customer_id = coalesce(excluded.customer_id, orders.customer_id),
       source_name = coalesce(excluded.source_name, orders.source_name),
       referring_site = coalesce(excluded.referring_site, orders.referring_site),
       landing_site = coalesce(excluded.landing_site, orders.landing_site),
       country = coalesce(excluded.country, orders.country),
       updated_at = now()
     returning id`,
    [
      shopId,
      shopifyIdToNumeric(payload.id),
      payload.name ?? (payload.order_number != null ? `#${payload.order_number}` : null),
      payload.created_at ?? new Date().toISOString(),
      payload.processed_at ?? null,
      payload.cancelled_at ?? null,
      Number(payload.total_price ?? 0),
      payload.currency ?? "EUR",
      payload.financial_status ?? null,
      payload.cart_token ?? null,
      payload.checkout_token ?? null,
      customerId,
      payload.source_name ?? null,
      payload.referring_site ?? null,
      payload.landing_site ?? null,
      payload.shipping_address?.country_code ?? payload.customer?.default_address?.country_code ?? null,
      payload.fulfillment_status ?? null,
      payload.subtotal_price != null ? Number(payload.subtotal_price) : null,
      payload.total_discounts != null ? Number(payload.total_discounts) : null,
      payload.total_tax != null ? Number(payload.total_tax) : null,
      payload.total_shipping_price_set?.shop_money?.amount != null
        ? Number(payload.total_shipping_price_set.shop_money.amount)
        : null,
    ]
  );

  let lineItems = 0;
  for (const li of payload.line_items ?? []) {
    await query(
      `insert into order_line_items (shop_id, order_id, shopify_line_item_id, shopify_product_id, shopify_variant_id, title, sku, quantity, price, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       on conflict (shop_id, shopify_line_item_id) do update set
         quantity = excluded.quantity, price = excluded.price, updated_at = now()`,
      [
        shopId,
        order!.id,
        shopifyIdToNumeric(li.id),
        shopifyIdToNumeric(li.product_id),
        shopifyIdToNumeric(li.variant_id),
        li.title ?? null,
        li.sku ?? null,
        li.quantity ?? 1,
        Number(li.price ?? 0),
      ]
    );
    lineItems++;
  }

  let refunds = 0;
  for (const r of payload.refunds ?? []) {
    const amount = (r.transactions ?? []).reduce((acc, t) => acc + Number(t.amount ?? 0), 0);
    await query(
      `insert into refunds (shop_id, order_id, shopify_refund_id, amount, currency, note, created_at_shopify, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (shop_id, shopify_refund_id) do update set
         amount = excluded.amount, note = excluded.note, updated_at = now()`,
      [
        shopId,
        order!.id,
        shopifyIdToNumeric(r.id),
        amount,
        r.transactions?.[0]?.currency ?? payload.currency ?? "EUR",
        r.note ?? null,
        r.created_at ?? null,
      ]
    );
    refunds++;
  }

  return { lineItems, refunds };
}

// ─── Webhook deliveries (déduplication + journal) ────────────────────────────

export async function recordWebhookDelivery(input: {
  deliveryId: string;
  topic: string;
  shopDomain: string | null;
  shopId: string | null;
  payload: unknown;
}): Promise<"new" | "duplicate"> {
  const rows = await query<{ id: string }>(
    `insert into webhook_deliveries (delivery_id, topic, shop_domain, shop_id, payload)
     values ($1,$2,$3,$4,$5)
     on conflict (delivery_id) do nothing
     returning id`,
    [input.deliveryId, input.topic, input.shopDomain, input.shopId, JSON.stringify(input.payload ?? null)]
  );
  return rows.length > 0 ? "new" : "duplicate";
}

export async function markWebhookDelivery(
  deliveryId: string,
  status: "processed" | "error",
  errorMessage?: string
): Promise<void> {
  await query(
    `update webhook_deliveries set status = $2, error_message = $3, processed_at = now() where delivery_id = $1`,
    [deliveryId, status, errorMessage ?? null]
  );
}

// ─── Statistiques pour Settings / diagnostic ─────────────────────────────────

export type ShopStats = {
  products: number;
  variants: number;
  orders: number;
  refunds: number;
  events: number;
  sessions: number;
  webhooks: number;
  lastEventAt: string | null;
};

export async function getShopStats(shopId: string): Promise<ShopStats> {
  const row = await queryOne<Record<string, string>>(
    `select
       (select count(*) from products where shop_id = $1) as products,
       (select count(*) from product_variants where shop_id = $1) as variants,
       (select count(*) from orders where shop_id = $1) as orders,
       (select count(*) from refunds where shop_id = $1) as refunds,
       (select count(*) from tracking_events where shop_id = $1) as events,
       (select count(*) from visitor_sessions where shop_id = $1) as sessions,
       (select count(*) from webhook_deliveries where shop_id = $1) as webhooks,
       (select max(occurred_at)::text from tracking_events where shop_id = $1) as last_event_at`,
    [shopId]
  );
  return {
    products: Number(row?.products ?? 0),
    variants: Number(row?.variants ?? 0),
    orders: Number(row?.orders ?? 0),
    refunds: Number(row?.refunds ?? 0),
    events: Number(row?.events ?? 0),
    sessions: Number(row?.sessions ?? 0),
    webhooks: Number(row?.webhooks ?? 0),
    lastEventAt: row?.last_event_at ?? null,
  };
}

// ─── Anomalies persistées (instantané de la dernière réconciliation) ─────────

export async function replaceAnomalies(
  shopId: string,
  anomalies: {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    affectedSessions: number;
    affectedRevenue?: number;
    probableCause?: string;
    recommendedAction?: string;
  }[]
): Promise<void> {
  await query("delete from anomalies where shop_id = $1", [shopId]);
  for (const a of anomalies) {
    await query(
      `insert into anomalies (shop_id, anomaly_key, type, severity, title, description, affected_sessions, affected_revenue, probable_cause, recommended_action)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (shop_id, anomaly_key) do nothing`,
      [
        shopId,
        a.id,
        a.type,
        a.severity,
        a.title,
        a.description,
        a.affectedSessions,
        a.affectedRevenue ?? null,
        a.probableCause ?? null,
        a.recommendedAction ?? null,
      ]
    );
  }
}

// ─── Connexion manuelle par token Admin API (Option B) ───────────────────────

export async function upsertManualConnection(input: {
  domain: string;
  name?: string;
  currency?: string;
  timezone?: string;
  scopes: string[];
  accessToken: string;
  apiVersion: string;
}): Promise<ShopRow> {
  const tokenHint = `••••••••${input.accessToken.slice(-4)}`;
  const shop = await queryOne<ShopRow>(
    `insert into shops (shopify_domain, name, currency, timezone, api_status, installed_scopes,
        connected_at, uninstalled_at, connection_method, api_version, token_hint, api_error,
        last_api_check_at, data_mode, updated_at)
     values ($1, $2, coalesce($3,'EUR'), coalesce($4,'Europe/Paris'), 'connected', $5,
        now(), null, 'manual_token', $6, $7, null, now(), 'live', now())
     on conflict (shopify_domain) do update set
       name = coalesce(excluded.name, shops.name),
       currency = coalesce($3, shops.currency),
       timezone = coalesce($4, shops.timezone),
       api_status = 'connected',
       installed_scopes = excluded.installed_scopes,
       connected_at = now(),
       uninstalled_at = null,
       connection_method = 'manual_token',
       api_version = excluded.api_version,
       token_hint = excluded.token_hint,
       api_error = null,
       last_api_check_at = now(),
       data_mode = 'live',
       updated_at = now()
     returning *`,
    [input.domain, input.name ?? null, input.currency ?? null, input.timezone ?? null,
      input.scopes.join(","), input.apiVersion, tokenHint]
  );
  await query(
    `insert into shopify_tokens (shop_id, encrypted_token, scopes, updated_at)
     values ($1, $2, $3, now())
     on conflict (shop_id) do update set
       encrypted_token = excluded.encrypted_token,
       scopes = excluded.scopes,
       updated_at = now()`,
    [shop!.id, encryptSecret(input.accessToken), input.scopes.join(",")]
  );
  return shop!;
}

export async function updateShopApiCheck(shopId: string, ok: boolean, error?: string): Promise<void> {
  await query(
    `update shops set last_api_check_at = now(),
       api_error = $2,
       api_status = case when $3 then 'connected' else 'error' end,
       updated_at = now()
     where id = $1`,
    [shopId, error ?? null, ok]
  );
}

export async function setDataMode(shopId: string, mode: "live" | "demo"): Promise<void> {
  await query(`update shops set data_mode = $2, updated_at = now() where id = $1`, [shopId, mode]);
}

/**
 * Déconnexion explicite : token supprimé, boutique repassée en
 * « disconnected ». Les données synchronisées ne sont supprimées que si
 * deleteData est demandé explicitement.
 */
export async function disconnectShop(shopId: string, deleteData: boolean): Promise<void> {
  await query("delete from shopify_tokens where shop_id = $1", [shopId]);
  if (deleteData) {
    await query("delete from shops where id = $1", [shopId]); // cascade sur toutes les tables
  } else {
    await query(
      `update shops set api_status = 'disconnected', pixel_status = 'not_installed',
         token_hint = null, api_error = null, uninstalled_at = now(), updated_at = now()
       where id = $1`,
      [shopId]
    );
  }
}
