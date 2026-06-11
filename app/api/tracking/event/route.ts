import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/server/db";
import { isDatabaseConfigured } from "@/lib/server/env";
import { getShopByDomain, setPixelStatus } from "@/lib/server/repo";

/**
 * Ingestion des événements du Web Pixel Shopify.
 *
 * Pipeline : validation (zod) → anti-spam → déduplication (clé unique) →
 * insertion tracking_events → upsert visitor_sessions.
 * Tout événement entre avec le statut `observed` : il ne devient `confirmed`
 * que via la réconciliation avec une vraie commande Shopify.
 */

const ALLOWED_EVENTS = new Set([
  "session_started",
  "page_viewed",
  "landing_page_viewed",
  "referrer_detected",
  "utm_detected",
  "collection_viewed",
  "product_viewed",
  "search_submitted",
  "filter_used",
  "sort_used",
  "scroll_depth_reached",
  "image_clicked",
  "reviews_clicked",
  "shipping_info_clicked",
  "faq_clicked",
  "variant_selected",
  "quantity_changed",
  "product_added_to_cart",
  "product_removed_from_cart",
  "cart_viewed",
  "checkout_started",
  "checkout_contact_info_submitted",
  "checkout_shipping_info_submitted",
  "checkout_shipping_method_selected",
  "discount_code_entered",
  "discount_code_accepted",
  "discount_code_rejected",
  "payment_step_reached",
  "payment_info_submitted",
  "checkout_completed",
]);

const eventSchema = z.object({
  shopDomain: z.string().min(4).max(120),
  visitorId: z.string().min(4).max(120),
  sessionId: z.string().min(4).max(120),
  eventName: z.string().refine((v) => ALLOWED_EVENTS.has(v), "eventName inconnu"),
  timestamp: z.string().datetime().optional(),
  pageUrl: z.string().max(2000).optional(),
  referrer: z.string().max(2000).optional(),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  browser: z.string().max(120).optional(),
  country: z.string().max(8).optional(),
  productId: z.string().max(120).optional(),
  variantId: z.string().max(120).optional(),
  sku: z.string().max(120).optional(),
  productTitle: z.string().max(500).optional(),
  variantTitle: z.string().max(500).optional(),
  quantity: z.number().int().min(0).max(10000).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  currency: z.string().max(8).optional(),
  cartToken: z.string().max(255).optional(),
  checkoutToken: z.string().max(255).optional(),
  orderId: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PixelEventInput = z.infer<typeof eventSchema>;

// ─── Anti-spam basique : fenêtre glissante en mémoire par boutique+IP ────────

const buckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 240; // événements / minute / (boutique, IP)

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count++;
  if (buckets.size > 10_000) buckets.clear(); // garde-fou mémoire
  return bucket.count > RATE_LIMIT;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // le pixel tourne dans la sandbox Shopify
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalide", details: parsed.error.issues.slice(0, 3).map((i) => i.message) },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const event = parsed.data;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { mode: "demo", accepted: false, reason: "Aucune base configurée : événement non stocké." },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`${event.shopDomain}:${ip}`)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: CORS_HEADERS });
  }

  // Seules les boutiques enregistrées peuvent pousser des événements
  const shop = await getShopByDomain(event.shopDomain.toLowerCase());
  if (!shop || shop.api_status === "disconnected") {
    return NextResponse.json(
      { error: "Boutique inconnue ou déconnectée" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const occurredAt = event.timestamp ?? new Date().toISOString();
  // Déduplication : même session + même événement + même produit dans une
  // fenêtre de 5 secondes → une seule insertion.
  const bucket5s = Math.floor(new Date(occurredAt).getTime() / 5000);
  const dedupeKey = createHash("sha256")
    .update([event.sessionId, event.eventName, event.productId ?? "", event.checkoutToken ?? "", bucket5s].join("|"))
    .digest("hex");

  try {
    // Session : créée au premier événement, prolongée ensuite
    const session = await queryOne<{ id: string }>(
      `insert into visitor_sessions (shop_id, session_key, visitor_key, started_at, ended_at, source, medium, campaign, landing_page, referrer, device, browser, country, updated_at)
       values ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9, coalesce($10,'desktop'), $11, $12, now())
       on conflict (shop_id, session_key) do update set
         ended_at = greatest(visitor_sessions.ended_at, excluded.ended_at),
         duration_seconds = greatest(0, extract(epoch from (greatest(visitor_sessions.ended_at, excluded.ended_at) - visitor_sessions.started_at)))::int,
         source = coalesce(visitor_sessions.source, excluded.source),
         medium = coalesce(visitor_sessions.medium, excluded.medium),
         campaign = coalesce(visitor_sessions.campaign, excluded.campaign),
         country = coalesce(visitor_sessions.country, excluded.country),
         updated_at = now()
       returning id`,
      [
        shop.id,
        event.sessionId,
        event.visitorId,
        occurredAt,
        event.utmSource ?? null,
        event.utmMedium ?? null,
        event.utmCampaign ?? null,
        event.pageUrl ?? null,
        event.referrer ?? null,
        event.device ?? null,
        event.browser ?? null,
        event.country ?? null,
      ]
    );

    const inserted = await query<{ id: string }>(
      `insert into tracking_events (shop_id, session_id, session_key, visitor_key, event_name, occurred_at,
         page_url, referrer, source, medium, campaign, content, term, device, browser, country,
         product_id, variant_id, sku, product_title, variant_title, quantity, price, currency,
         cart_token, checkout_token, order_id, status, metadata, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'observed',$28,$29)
       on conflict (shop_id, dedupe_key) do nothing
       returning id`,
      [
        shop.id,
        session!.id,
        event.sessionId,
        event.visitorId,
        event.eventName,
        occurredAt,
        event.pageUrl ?? null,
        event.referrer ?? null,
        event.utmSource ?? null,
        event.utmMedium ?? null,
        event.utmCampaign ?? null,
        event.utmContent ?? null,
        event.utmTerm ?? null,
        event.device ?? null,
        event.browser ?? null,
        event.country ?? null,
        event.productId ?? null,
        event.variantId ?? null,
        event.sku ?? null,
        event.productTitle ?? null,
        event.variantTitle ?? null,
        event.quantity ?? null,
        event.price ?? null,
        event.currency ?? null,
        event.cartToken ?? null,
        event.checkoutToken ?? null,
        event.orderId ?? null,
        JSON.stringify(event.metadata ?? {}),
        dedupeKey,
      ]
    );

    // Premier événement reçu = preuve que le pixel est actif
    if (shop.pixel_status !== "installed") {
      await setPixelStatus(shop.id, "installed");
    }

    return NextResponse.json(
      { accepted: inserted.length > 0, duplicate: inserted.length === 0, status: "observed" },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[tracking] Insertion impossible :", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500, headers: CORS_HEADERS });
  }
}
