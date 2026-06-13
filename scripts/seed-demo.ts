/**
 * Seed du jeu de démonstration dans PostgreSQL.
 *
 * Insère la boutique démo (is_demo = true), ses produits, sessions,
 * événements et commandes dans les tables live. Utile pour tester le
 * pipeline base → datasource → réconciliation sans boutique Shopify réelle.
 *
 * Note : une boutique is_demo n'active PAS le mode live de l'interface
 * (le mode live exige une connexion OAuth réelle).
 *
 * Usage : npm run db:seed-demo
 */
import "dotenv/config";
import { Client } from "pg";
import { getDataset } from "../data/dataset";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant (voir .env.example)");
    process.exit(1);
  }
  // sslmode retiré de l'URL pour que l'objet ssl explicite soit bien appliqué.
  const cleanedUrl = process.env.DATABASE_URL
    .replace(/([?&])(sslmode|ssl|sslcert|sslkey|sslrootcert|uselibpqcompat)=[^&]*/gi, "$1")
    .replace(/[?&]$/, "");
  const db = new Client({
    connectionString: cleanedUrl,
    ssl: /localhost|127\.0\.0\.1/.test(cleanedUrl) ? false : { rejectUnauthorized: false },
  });
  await db.connect();

  const dataset = getDataset();
  const domain = dataset.shop.shopifyDomain;

  console.log(`Seed de la boutique démo « ${domain} »…`);

  const shopRes = await db.query(
    `insert into shops (shopify_domain, name, currency, timezone, is_demo, api_status, pixel_status, connected_at)
     values ($1, $2, $3, $4, true, 'demo', 'demo', now())
     on conflict (shopify_domain) do update set updated_at = now()
     returning id`,
    [domain, dataset.shop.name, dataset.shop.currency, dataset.shop.timezone]
  );
  const shopId: string = shopRes.rows[0].id;

  // Idempotence : on repart de zéro pour cette boutique
  for (const table of ["tracking_events", "visitor_sessions", "order_line_items", "refunds", "orders", "product_variants", "products", "anomalies"]) {
    await db.query(`delete from ${table} where shop_id = $1`, [shopId]);
  }

  for (const p of dataset.products) {
    await db.query(
      `insert into products (shop_id, shopify_product_id, title, handle, vendor, product_type, status, price_min, price_max, cost, stock)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [shopId, p.id, p.title, p.handle, p.vendor ?? null, p.productType ?? null, p.status, p.priceMin, p.priceMax, p.cost ?? null, p.stock ?? null]
    );
  }
  console.log(`  ${dataset.products.length} produits`);

  let eventCount = 0;
  for (const s of dataset.sessions) {
    const sessionRes = await db.query(
      `insert into visitor_sessions (shop_id, session_key, visitor_key, started_at, ended_at, duration_seconds,
         source, medium, campaign, landing_page, device, browser, country, status, reliability_score)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning id`,
      [
        shopId, s.id, s.visitorId, s.startedAt, s.endedAt ?? null, s.durationSeconds ?? null,
        s.source ?? null, s.medium ?? null, s.campaign ?? null, s.landingPage,
        s.device, s.browser ?? null, s.country ?? null, s.status, s.reliabilityScore,
      ]
    );
    for (const e of s.events) {
      await db.query(
        `insert into tracking_events (shop_id, session_id, session_key, visitor_key, event_name, occurred_at,
           page_url, referrer, source, medium, campaign, device, browser, country,
           product_id, variant_id, sku, product_title, variant_title, quantity, price, currency,
           cart_token, checkout_token, order_id, status, metadata, dedupe_key)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
         on conflict (shop_id, dedupe_key) do nothing`,
        [
          shopId, sessionRes.rows[0].id, s.id, s.visitorId, e.eventName, e.timestamp,
          e.pageUrl ?? null, e.referrer ?? null, e.source ?? null, e.medium ?? null, e.campaign ?? null,
          e.device ?? null, e.browser ?? null, e.country ?? null,
          e.productId ?? null, e.variantId ?? null, e.sku ?? null, e.productTitle ?? null, e.variantTitle ?? null,
          e.quantity ?? null, e.price ?? null, e.currency ?? null,
          e.cartToken ?? null, e.checkoutToken ?? null, e.orderId ?? null, e.status,
          JSON.stringify(e.metadata ?? {}), e.id,
        ]
      );
      eventCount++;
    }
  }
  console.log(`  ${dataset.sessions.length} sessions, ${eventCount} événements`);

  for (const o of dataset.orders) {
    const orderRes = await db.query(
      `insert into orders (shop_id, shopify_order_id, order_number, created_at_shopify, total_price, currency,
         financial_status, cart_token, checkout_token, country)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [shopId, o.id, o.orderNumber, o.createdAt, o.totalPrice, o.currency, o.financialStatus, o.cartToken ?? null, o.checkoutToken ?? null, o.country ?? null]
    );
    for (const [i, productId] of o.productIds.entries()) {
      const product = dataset.products.find((p) => p.id === productId);
      await db.query(
        `insert into order_line_items (shop_id, order_id, shopify_line_item_id, shopify_product_id, title, quantity, price)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [shopId, orderRes.rows[0].id, `${o.id}_li${i}`, productId, product?.title ?? null, 1, product?.priceMin ?? 0]
      );
    }
  }
  console.log(`  ${dataset.orders.length} commandes`);

  await db.end();
  console.log("Seed terminé.");
}

main().catch((err) => {
  console.error("Échec du seed :", err instanceof Error ? err.message : err);
  process.exit(1);
});
