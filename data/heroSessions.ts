import type { Device, TrackingEvent, VisitorSession } from "@/lib/types";
import { at } from "@/lib/utils";

/**
 * 13 sessions « héros » écrites à la main pour démontrer le scénario central :
 * aujourd'hui, Shopify affiche 5 paiements atteints pour seulement 2 ajouts
 * panier. Data Lens reconstruit les parcours et montre que 4 paiements
 * proviennent de paniers créés avant la période ou de checkouts repris.
 */

const shopId = "shop_demo_01";

type EvSpec = Partial<TrackingEvent> & { eventName: string; timestamp: string };

type SessionSpec = Omit<VisitorSession, "events" | "shopId" | "durationSeconds"> & {
  events: EvSpec[];
};

function build(spec: SessionSpec): VisitorSession {
  const events: TrackingEvent[] = spec.events.map((e, i) => ({
    id: `${spec.id}_e${i + 1}`,
    shopId,
    visitorId: spec.visitorId,
    sessionId: spec.id,
    device: spec.device,
    country: spec.country,
    browser: spec.browser,
    source: spec.source,
    medium: spec.medium,
    campaign: spec.campaign,
    currency: "EUR",
    status: "observed",
    ...e,
  }));
  const started = new Date(spec.startedAt).getTime();
  const ended = spec.endedAt ? new Date(spec.endedAt).getTime() : started;
  return {
    ...spec,
    shopId,
    events,
    durationSeconds: Math.max(0, Math.round((ended - started) / 1000)),
  };
}

// ─── Session 1 — A81F : parcours complet, achat confirmé Shopify ─────────────
const s1 = build({
  id: "ses_a81f",
  visitorId: "vis_0142",
  startedAt: at(0, "21:28:12"),
  endedAt: at(0, "21:33:21"),
  source: "google",
  medium: "cpc",
  campaign: "pmax-lustres",
  landingPage: "/products/lustre-cristal-moderne",
  device: "desktop",
  browser: "Chrome",
  country: "FR",
  status: "converted",
  reliabilityScore: 98,
  events: [
    { eventName: "session_started", timestamp: at(0, "21:28:12"), pageUrl: "/products/lustre-cristal-moderne", referrer: "https://www.google.com" },
    { eventName: "utm_detected", timestamp: at(0, "21:28:12"), metadata: { utm_source: "google", utm_medium: "cpc", utm_campaign: "pmax-lustres" } },
    { eventName: "landing_page_viewed", timestamp: at(0, "21:28:13"), pageUrl: "/products/lustre-cristal-moderne" },
    { eventName: "product_viewed", timestamp: at(0, "21:28:18"), productId: "p1", productTitle: "Lustre Cristal Moderne", variantTitle: "Doré / 60 cm", price: 189.99, pageUrl: "/products/lustre-cristal-moderne" },
    { eventName: "image_clicked", timestamp: at(0, "21:28:44"), productId: "p1", productTitle: "Lustre Cristal Moderne", metadata: { image: "dimensions" } },
    { eventName: "variant_selected", timestamp: at(0, "21:28:57"), productId: "p1", productTitle: "Lustre Cristal Moderne", variantTitle: "Doré / 60 cm", price: 189.99 },
    { eventName: "product_added_to_cart", timestamp: at(0, "21:29:06"), productId: "p1", productTitle: "Lustre Cristal Moderne", variantTitle: "Doré / 60 cm", quantity: 1, price: 189.99, cartToken: "crt_a81f01" },
    { eventName: "cart_viewed", timestamp: at(0, "21:29:22"), cartToken: "crt_a81f01", metadata: { subtotal: 189.99 } },
    { eventName: "checkout_started", timestamp: at(0, "21:29:48"), cartToken: "crt_a81f01", checkoutToken: "chk_a81f01", metadata: { cartCreatedAt: at(0, "21:29:06") } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "21:30:02"), checkoutToken: "chk_a81f01", metadata: { emailProvided: true, country: "France" } },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "21:30:14"), checkoutToken: "chk_a81f01", metadata: { shippingPrice: 0 } },
    { eventName: "checkout_shipping_method_selected", timestamp: at(0, "21:30:21"), checkoutToken: "chk_a81f01", metadata: { method: "Standard 5-7 jours", price: 0 } },
    { eventName: "payment_step_reached", timestamp: at(0, "21:30:39"), checkoutToken: "chk_a81f01" },
    { eventName: "payment_info_submitted", timestamp: at(0, "21:31:54"), checkoutToken: "chk_a81f01", metadata: { method: "card" } },
    { eventName: "checkout_completed", timestamp: at(0, "21:32:10"), checkoutToken: "chk_a81f01", orderId: "ord_1001", price: 189.99 },
    { eventName: "order_created", timestamp: at(0, "21:32:11"), orderId: "ord_1001", price: 189.99, status: "confirmed" },
    { eventName: "order_paid", timestamp: at(0, "21:33:21"), orderId: "ord_1001", price: 189.99, status: "confirmed" },
  ],
});

// ─── Session 2 — produit vu, aucun ajout panier ──────────────────────────────
const s2 = build({
  id: "ses_b2c4",
  visitorId: "vis_0287",
  startedAt: at(0, "10:12:05"),
  endedAt: at(0, "10:14:51"),
  source: "facebook",
  medium: "paid",
  campaign: "lustres-video-1",
  landingPage: "/products/suspension-verre-fume",
  device: "mobile",
  browser: "Safari iOS",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 94,
  events: [
    { eventName: "session_started", timestamp: at(0, "10:12:05"), pageUrl: "/products/suspension-verre-fume", referrer: "https://m.facebook.com" },
    { eventName: "utm_detected", timestamp: at(0, "10:12:05"), metadata: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "lustres-video-1" } },
    { eventName: "product_viewed", timestamp: at(0, "10:12:09"), productId: "p2", productTitle: "Suspension Verre Fumé", price: 129.0, pageUrl: "/products/suspension-verre-fume" },
    { eventName: "image_clicked", timestamp: at(0, "10:12:31"), productId: "p2", productTitle: "Suspension Verre Fumé" },
    { eventName: "scroll_depth_reached", timestamp: at(0, "10:13:02"), productId: "p2", metadata: { depth: 75 } },
    { eventName: "shipping_info_clicked", timestamp: at(0, "10:13:40"), productId: "p2", productTitle: "Suspension Verre Fumé" },
  ],
});

// ─── Session 3 — ajout panier puis abandon panier ────────────────────────────
const s3 = build({
  id: "ses_c9d1",
  visitorId: "vis_0311",
  startedAt: at(0, "14:05:48"),
  endedAt: at(0, "14:09:33"),
  source: "tiktok",
  medium: "paid",
  campaign: "deco-chambre-ugc",
  landingPage: "/products/lampe-de-chevet-doree",
  device: "mobile",
  browser: "Chrome Android",
  country: "BE",
  status: "abandoned",
  reliabilityScore: 95,
  events: [
    { eventName: "session_started", timestamp: at(0, "14:05:48"), pageUrl: "/products/lampe-de-chevet-doree", referrer: "https://www.tiktok.com" },
    { eventName: "utm_detected", timestamp: at(0, "14:05:48"), metadata: { utm_source: "tiktok", utm_medium: "paid", utm_campaign: "deco-chambre-ugc" } },
    { eventName: "product_viewed", timestamp: at(0, "14:05:53"), productId: "p4", productTitle: "Lampe de Chevet Dorée", price: 59.9, pageUrl: "/products/lampe-de-chevet-doree" },
    { eventName: "variant_selected", timestamp: at(0, "14:06:42"), productId: "p4", productTitle: "Lampe de Chevet Dorée", variantTitle: "Or brossé", price: 59.9 },
    { eventName: "product_added_to_cart", timestamp: at(0, "14:07:32"), productId: "p4", productTitle: "Lampe de Chevet Dorée", quantity: 1, price: 59.9, cartToken: "crt_c9d101" },
    { eventName: "cart_viewed", timestamp: at(0, "14:07:48"), cartToken: "crt_c9d101", metadata: { subtotal: 59.9 } },
  ],
});

// ─── Session 4 — checkout repris (panier d'hier), abandon à la livraison ─────
const s4 = build({
  id: "ses_d4e8",
  visitorId: "vis_0099",
  startedAt: at(0, "16:40:11"),
  endedAt: at(0, "16:44:02"),
  source: "direct",
  medium: undefined,
  landingPage: "/cart",
  device: "desktop",
  browser: "Firefox",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 88,
  events: [
    { eventName: "session_started", timestamp: at(0, "16:40:11"), pageUrl: "/cart" },
    { eventName: "cart_viewed", timestamp: at(0, "16:40:15"), cartToken: "crt_d4e8y1", metadata: { subtotal: 149.8, cartCreatedAt: at(1, "21:18:40") } },
    { eventName: "checkout_started", timestamp: at(0, "16:41:03"), cartToken: "crt_d4e8y1", checkoutToken: "chk_d4e801", status: "reconciled", metadata: { cartCreatedAt: at(1, "21:18:40"), resumed: true } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "16:42:20"), checkoutToken: "chk_d4e801", metadata: { emailProvided: true, country: "France" } },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "16:43:38"), checkoutToken: "chk_d4e801", metadata: { shippingPrice: 6.9 } },
  ],
});

// ─── Session 5 — paiement atteint puis abandon (panier créé il y a 2 jours) ──
const s5 = build({
  id: "ses_e7f2",
  visitorId: "vis_0076",
  startedAt: at(0, "18:22:30"),
  endedAt: at(0, "18:27:55"),
  source: "google",
  medium: "cpc",
  campaign: "search-marque",
  landingPage: "/cart",
  device: "desktop",
  browser: "Chrome",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 86,
  events: [
    { eventName: "session_started", timestamp: at(0, "18:22:30"), pageUrl: "/cart", referrer: "https://www.google.com" },
    { eventName: "utm_detected", timestamp: at(0, "18:22:30"), metadata: { utm_source: "google", utm_medium: "cpc", utm_campaign: "search-marque" } },
    { eventName: "cart_viewed", timestamp: at(0, "18:22:36"), cartToken: "crt_e7f2y2", metadata: { subtotal: 178.9, cartCreatedAt: at(2, "12:05:10") } },
    { eventName: "checkout_started", timestamp: at(0, "18:23:12"), cartToken: "crt_e7f2y2", checkoutToken: "chk_e7f201", status: "reconciled", metadata: { cartCreatedAt: at(2, "12:05:10"), resumed: true } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "18:24:05"), checkoutToken: "chk_e7f201" },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "18:25:18"), checkoutToken: "chk_e7f201", metadata: { shippingPrice: 0 } },
    { eventName: "checkout_shipping_method_selected", timestamp: at(0, "18:25:50"), checkoutToken: "chk_e7f201" },
    { eventName: "payment_step_reached", timestamp: at(0, "18:26:44"), checkoutToken: "chk_e7f201", status: "out_of_period", price: 178.9, metadata: { cartCreatedAt: at(2, "12:05:10") } },
  ],
});

// ─── Session 6 — paiement atteint via email panier abandonné (panier d'hier) ─
const s6 = build({
  id: "ses_f1a9",
  visitorId: "vis_0064",
  startedAt: at(0, "20:05:02"),
  endedAt: at(0, "20:09:17"),
  source: "email",
  medium: "email",
  campaign: "panier-abandonne",
  landingPage: "/checkouts/recover",
  device: "mobile",
  browser: "Safari iOS",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 84,
  events: [
    { eventName: "session_started", timestamp: at(0, "20:05:02"), pageUrl: "/checkouts/recover", referrer: "email" },
    { eventName: "utm_detected", timestamp: at(0, "20:05:02"), metadata: { utm_source: "klaviyo", utm_medium: "email", utm_campaign: "panier-abandonne" } },
    { eventName: "checkout_started", timestamp: at(0, "20:05:11"), cartToken: "crt_f1a9y1", checkoutToken: "chk_f1a9y1", status: "reconciled", metadata: { cartCreatedAt: at(1, "22:41:27"), resumed: true } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "20:05:58"), checkoutToken: "chk_f1a9y1", metadata: { prefilled: true } },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "20:06:52"), checkoutToken: "chk_f1a9y1", metadata: { shippingPrice: 4.9 } },
    { eventName: "checkout_shipping_method_selected", timestamp: at(0, "20:07:21"), checkoutToken: "chk_f1a9y1" },
    { eventName: "payment_step_reached", timestamp: at(0, "20:08:04"), checkoutToken: "chk_f1a9y1", status: "out_of_period", price: 89.9, metadata: { cartCreatedAt: at(1, "22:41:27") } },
  ],
});

// ─── Session 7 — HIER : achat confirmé mais UTM manquant ─────────────────────
const s7 = build({
  id: "ses_g3h7",
  visitorId: "vis_0051",
  startedAt: at(1, "19:34:40"),
  endedAt: at(1, "19:42:28"),
  source: undefined,
  medium: undefined,
  landingPage: "/products/suspension-rotin-naturel",
  device: "mobile",
  browser: "Instagram in-app",
  country: "FR",
  status: "converted",
  reliabilityScore: 72,
  events: [
    { eventName: "session_started", timestamp: at(1, "19:34:40"), pageUrl: "/products/suspension-rotin-naturel", referrer: "https://l.instagram.com", metadata: { suspectedPaid: true } },
    { eventName: "referrer_detected", timestamp: at(1, "19:34:40"), referrer: "https://l.instagram.com", status: "suspect", metadata: { note: "Trafic payé probable sans UTM" } },
    { eventName: "product_viewed", timestamp: at(1, "19:34:46"), productId: "p6", productTitle: "Suspension Rotin Naturel", price: 99.0 },
    { eventName: "product_added_to_cart", timestamp: at(1, "19:36:12"), productId: "p6", productTitle: "Suspension Rotin Naturel", quantity: 1, price: 99.0, cartToken: "crt_g3h701" },
    { eventName: "checkout_started", timestamp: at(1, "19:37:05"), cartToken: "crt_g3h701", checkoutToken: "chk_g3h701", metadata: { cartCreatedAt: at(1, "19:36:12") } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(1, "19:38:14"), checkoutToken: "chk_g3h701" },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(1, "19:39:31"), checkoutToken: "chk_g3h701" },
    { eventName: "checkout_shipping_method_selected", timestamp: at(1, "19:39:58"), checkoutToken: "chk_g3h701" },
    { eventName: "payment_step_reached", timestamp: at(1, "19:40:22"), checkoutToken: "chk_g3h701" },
    { eventName: "payment_info_submitted", timestamp: at(1, "19:41:39"), checkoutToken: "chk_g3h701" },
    { eventName: "checkout_completed", timestamp: at(1, "19:42:01"), checkoutToken: "chk_g3h701", orderId: "ord_0993", price: 99.0 },
    { eventName: "order_created", timestamp: at(1, "19:42:02"), orderId: "ord_0993", price: 99.0, status: "confirmed" },
    { eventName: "order_paid", timestamp: at(1, "19:42:28"), orderId: "ord_0993", price: 99.0, status: "confirmed" },
  ],
});

// ─── Session 8 — Google Ads, faible engagement (rebond) ──────────────────────
const s8 = build({
  id: "ses_h8j4",
  visitorId: "vis_0402",
  startedAt: at(0, "11:03:17"),
  endedAt: at(0, "11:03:41"),
  source: "google",
  medium: "cpc",
  campaign: "pmax-large",
  landingPage: "/collections/suspensions",
  device: "mobile",
  browser: "Chrome Android",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 92,
  events: [
    { eventName: "session_started", timestamp: at(0, "11:03:17"), pageUrl: "/collections/suspensions", referrer: "https://www.google.com" },
    { eventName: "utm_detected", timestamp: at(0, "11:03:17"), metadata: { utm_source: "google", utm_medium: "cpc", utm_campaign: "pmax-large" } },
    { eventName: "collection_viewed", timestamp: at(0, "11:03:19"), pageUrl: "/collections/suspensions", metadata: { collection: "Suspensions" } },
    { eventName: "scroll_depth_reached", timestamp: at(0, "11:03:35"), metadata: { depth: 25 } },
  ],
});

// ─── Session 9 — SEO, forte intention, longue exploration ────────────────────
const s9 = build({
  id: "ses_i5k2",
  visitorId: "vis_0388",
  startedAt: at(0, "15:47:02"),
  endedAt: at(0, "15:53:26"),
  source: "google",
  medium: "organic",
  landingPage: "/blogs/guides/choisir-suspension-salon",
  device: "desktop",
  browser: "Edge",
  country: "CH",
  status: "abandoned",
  reliabilityScore: 96,
  events: [
    { eventName: "session_started", timestamp: at(0, "15:47:02"), pageUrl: "/blogs/guides/choisir-suspension-salon", referrer: "https://www.google.com" },
    { eventName: "referrer_detected", timestamp: at(0, "15:47:02"), referrer: "https://www.google.com", metadata: { type: "organic" } },
    { eventName: "page_viewed", timestamp: at(0, "15:47:02"), pageUrl: "/blogs/guides/choisir-suspension-salon" },
    { eventName: "search_submitted", timestamp: at(0, "15:48:35"), term: "suspension rotin", pageUrl: "/search" },
    { eventName: "product_viewed", timestamp: at(0, "15:48:51"), productId: "p6", productTitle: "Suspension Rotin Naturel", price: 99.0 },
    { eventName: "image_clicked", timestamp: at(0, "15:49:20"), productId: "p6", productTitle: "Suspension Rotin Naturel" },
    { eventName: "scroll_depth_reached", timestamp: at(0, "15:50:08"), productId: "p6", metadata: { depth: 100 } },
    { eventName: "reviews_clicked", timestamp: at(0, "15:50:44"), productId: "p6", productTitle: "Suspension Rotin Naturel" },
    { eventName: "faq_clicked", timestamp: at(0, "15:52:01"), productId: "p6", metadata: { question: "Dimensions et installation" } },
    { eventName: "shipping_info_clicked", timestamp: at(0, "15:53:10"), productId: "p6" },
  ],
});

// ─── Session 10 — mobile, checkout repris (retargeting), abandon paiement ────
const s10 = build({
  id: "ses_j9l6",
  visitorId: "vis_0058",
  startedAt: at(0, "13:21:44"),
  endedAt: at(0, "13:26:30"),
  source: "facebook",
  medium: "paid",
  campaign: "retargeting-panier",
  landingPage: "/checkouts/resume",
  device: "mobile",
  browser: "Safari iOS",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 82,
  events: [
    { eventName: "session_started", timestamp: at(0, "13:21:44"), pageUrl: "/checkouts/resume", referrer: "https://m.facebook.com" },
    { eventName: "utm_detected", timestamp: at(0, "13:21:44"), metadata: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "retargeting-panier" } },
    { eventName: "checkout_started", timestamp: at(0, "13:21:52"), cartToken: "crt_j9l6y3", checkoutToken: "chk_j9l6y3", status: "reconciled", metadata: { cartCreatedAt: at(3, "20:14:55"), resumed: true } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "13:22:48"), checkoutToken: "chk_j9l6y3" },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "13:24:02"), checkoutToken: "chk_j9l6y3", metadata: { shippingPrice: 4.9 } },
    { eventName: "checkout_shipping_method_selected", timestamp: at(0, "13:24:39"), checkoutToken: "chk_j9l6y3" },
    { eventName: "payment_step_reached", timestamp: at(0, "13:25:21"), checkoutToken: "chk_j9l6y3", status: "out_of_period", price: 119.8, metadata: { cartCreatedAt: at(3, "20:14:55") } },
  ],
});

// ─── Session 11 — code promo refusé, abandon avant paiement ──────────────────
const s11 = build({
  id: "ses_k2m8",
  visitorId: "vis_0117",
  startedAt: at(0, "17:12:09"),
  endedAt: at(0, "17:16:44"),
  source: "direct",
  medium: undefined,
  landingPage: "/cart",
  device: "desktop",
  browser: "Chrome",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 90,
  events: [
    { eventName: "session_started", timestamp: at(0, "17:12:09"), pageUrl: "/cart" },
    { eventName: "cart_viewed", timestamp: at(0, "17:12:14"), cartToken: "crt_k2m8y1", metadata: { subtotal: 139.8, cartCreatedAt: at(1, "13:02:33") } },
    { eventName: "checkout_started", timestamp: at(0, "17:12:51"), cartToken: "crt_k2m8y1", checkoutToken: "chk_k2m801", status: "reconciled", metadata: { cartCreatedAt: at(1, "13:02:33"), resumed: true } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "17:13:46"), checkoutToken: "chk_k2m801" },
    { eventName: "discount_code_entered", timestamp: at(0, "17:14:28"), checkoutToken: "chk_k2m801", metadata: { code: "BIENVENUE15" } },
    { eventName: "discount_code_rejected", timestamp: at(0, "17:14:31"), checkoutToken: "chk_k2m801", metadata: { code: "BIENVENUE15", reason: "Code expiré" } },
    { eventName: "discount_code_entered", timestamp: at(0, "17:15:50"), checkoutToken: "chk_k2m801", metadata: { code: "PROMO10" } },
    { eventName: "discount_code_rejected", timestamp: at(0, "17:15:52"), checkoutToken: "chk_k2m801", metadata: { code: "PROMO10", reason: "Code invalide" } },
  ],
});

// ─── Session 12 — checkout sans ajout panier connu (cart token inconnu) ──────
const s12 = build({
  id: "ses_l7n3",
  visitorId: "vis_0455",
  startedAt: at(0, "19:55:23"),
  endedAt: at(0, "20:01:08"),
  source: "instagram",
  medium: "referral",
  landingPage: "/cart",
  device: "mobile",
  browser: "Instagram in-app",
  country: "FR",
  status: "incomplete",
  reliabilityScore: 58,
  events: [
    { eventName: "session_started", timestamp: at(0, "19:55:23"), pageUrl: "/cart", referrer: "https://l.instagram.com" },
    { eventName: "referrer_detected", timestamp: at(0, "19:55:23"), referrer: "https://l.instagram.com" },
    { eventName: "cart_viewed", timestamp: at(0, "19:55:30"), metadata: { subtotal: 288.99, cartUnknown: true } },
    { eventName: "checkout_started", timestamp: at(0, "19:56:14"), checkoutToken: "chk_l7n301", status: "incomplete", metadata: { cartUnknown: true, note: "Aucun ajout panier observé pour ce panier (autre appareil probable)" } },
    { eventName: "checkout_contact_info_submitted", timestamp: at(0, "19:57:22"), checkoutToken: "chk_l7n301" },
    { eventName: "checkout_shipping_info_submitted", timestamp: at(0, "19:58:40"), checkoutToken: "chk_l7n301" },
    { eventName: "checkout_shipping_method_selected", timestamp: at(0, "19:59:12"), checkoutToken: "chk_l7n301" },
    { eventName: "payment_step_reached", timestamp: at(0, "19:59:47"), checkoutToken: "chk_l7n301", status: "incomplete", price: 288.99, metadata: { cartUnknown: true } },
  ],
});

// ─── Session 13 — HIER : le panier qui sera repris par la session 6 ──────────
const s13 = build({
  id: "ses_y2k3",
  visitorId: "vis_0064",
  startedAt: at(1, "22:38:14"),
  endedAt: at(1, "22:43:50"),
  source: "facebook",
  medium: "paid",
  campaign: "plafonniers-carrousel",
  landingPage: "/products/plafonnier-led-design",
  device: "mobile",
  browser: "Safari iOS",
  country: "FR",
  status: "abandoned",
  reliabilityScore: 93,
  events: [
    { eventName: "session_started", timestamp: at(1, "22:38:14"), pageUrl: "/products/plafonnier-led-design", referrer: "https://m.facebook.com" },
    { eventName: "utm_detected", timestamp: at(1, "22:38:14"), metadata: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "plafonniers-carrousel" } },
    { eventName: "product_viewed", timestamp: at(1, "22:38:20"), productId: "p3", productTitle: "Plafonnier LED Design", price: 89.9 },
    { eventName: "variant_selected", timestamp: at(1, "22:40:05"), productId: "p3", productTitle: "Plafonnier LED Design", variantTitle: "Blanc / 40 cm", price: 89.9 },
    { eventName: "product_added_to_cart", timestamp: at(1, "22:41:27"), productId: "p3", productTitle: "Plafonnier LED Design", quantity: 1, price: 89.9, cartToken: "crt_f1a9y1" },
    { eventName: "cart_viewed", timestamp: at(1, "22:41:44"), cartToken: "crt_f1a9y1", metadata: { subtotal: 89.9 } },
  ],
});

export const heroSessions: VisitorSession[] = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];

export const heroDevices: Device[] = ["mobile", "desktop", "tablet"];
