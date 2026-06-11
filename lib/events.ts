import type { EventStatus, TrackingEvent } from "./types";
import { formatEUR } from "./utils";

// ─── Libellés français des événements ────────────────────────────────────────

export const EVENT_LABELS: Record<string, string> = {
  session_started: "Arrive sur la boutique",
  page_viewed: "Page vue",
  landing_page_viewed: "Landing page vue",
  referrer_detected: "Référent détecté",
  utm_detected: "UTM détectés",
  collection_viewed: "Collection vue",
  product_viewed: "Produit vu",
  search_submitted: "Recherche effectuée",
  filter_used: "Filtre utilisé",
  sort_used: "Tri utilisé",
  scroll_depth_reached: "Profondeur de scroll",
  image_clicked: "Image ouverte",
  reviews_clicked: "Avis consultés",
  shipping_info_clicked: "Infos livraison consultées",
  faq_clicked: "FAQ consultée",
  variant_selected: "Variante sélectionnée",
  quantity_changed: "Quantité modifiée",
  product_added_to_cart: "Ajout panier",
  product_removed_from_cart: "Retrait du panier",
  cart_viewed: "Panier ouvert",
  checkout_started: "Checkout commencé",
  checkout_contact_info_submitted: "Coordonnées saisies",
  checkout_shipping_info_submitted: "Livraison renseignée",
  checkout_shipping_method_selected: "Mode de livraison choisi",
  discount_code_entered: "Code promo saisi",
  discount_code_accepted: "Code promo accepté",
  discount_code_rejected: "Code promo refusé",
  payment_step_reached: "Paiement atteint",
  payment_info_submitted: "Paiement soumis",
  checkout_completed: "Checkout finalisé",
  order_created: "Commande créée (Shopify)",
  order_paid: "Commande payée (Shopify)",
  order_cancelled: "Commande annulée",
  refund_created: "Remboursement créé",
  fulfillment_created: "Expédition créée",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  observed: "Observé",
  confirmed: "Confirmé Shopify",
  reconciled: "Réconcilié",
  incomplete: "Incomplet",
  out_of_period: "Hors période",
  suspect: "Suspect",
};

const MILESTONES = new Set([
  "session_started",
  "product_viewed",
  "product_added_to_cart",
  "cart_viewed",
  "checkout_started",
  "payment_step_reached",
  "payment_info_submitted",
  "checkout_completed",
  "order_paid",
  "discount_code_rejected",
]);

export const isMilestone = (e: TrackingEvent) => MILESTONES.has(e.eventName);

/** Lignes de détail affichées sous un événement dans la timeline. */
export function describeEvent(e: TrackingEvent): string[] {
  const lines: string[] = [];
  const meta = e.metadata ?? {};

  switch (e.eventName) {
    case "session_started":
      if (e.source) lines.push(`Source : ${formatSourceLabel(e.source, e.medium)}${e.campaign ? ` / ${e.campaign}` : ""}`);
      else if (e.referrer) lines.push(`Référent : ${e.referrer}`);
      else lines.push("Source : accès direct");
      if (e.pageUrl) lines.push(`Landing page : ${e.pageUrl}`);
      break;
    case "product_viewed":
      if (e.productTitle) lines.push(`Produit : ${e.productTitle}`);
      if (e.variantTitle) lines.push(`Variante : ${e.variantTitle}`);
      if (e.price != null) lines.push(`Prix : ${formatEUR(e.price)}`);
      break;
    case "variant_selected":
      if (e.variantTitle) lines.push(`Variante : ${e.variantTitle}`);
      break;
    case "product_added_to_cart":
    case "product_removed_from_cart":
      if (e.productTitle) lines.push(`Produit : ${e.productTitle}`);
      if (e.quantity != null) lines.push(`Quantité : ${e.quantity}`);
      if (e.price != null) lines.push(`Prix : ${formatEUR(e.price * (e.quantity ?? 1))}`);
      break;
    case "cart_viewed":
      if (typeof meta.subtotal === "number") lines.push(`Sous-total : ${formatEUR(meta.subtotal)}`);
      if (meta.cartUnknown) lines.push("Panier non rattaché à un ajout panier connu");
      break;
    case "checkout_started":
      if (meta.resumed) lines.push("Checkout repris (panier existant)");
      if (typeof meta.cartCreatedAt === "string") {
        lines.push(`Panier créé le ${new Date(meta.cartCreatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${new Date(meta.cartCreatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
      }
      if (meta.cartUnknown) lines.push("Aucun ajout panier rattachable (autre appareil probable)");
      break;
    case "checkout_contact_info_submitted":
      lines.push(`Email saisi : ${meta.emailProvided === false ? "non" : "oui"}`);
      if (typeof meta.country === "string") lines.push(`Pays : ${meta.country}`);
      break;
    case "checkout_shipping_info_submitted":
      if (typeof meta.shippingPrice === "number") lines.push(`Prix livraison : ${formatEUR(meta.shippingPrice)}`);
      break;
    case "checkout_shipping_method_selected":
      if (typeof meta.method === "string") lines.push(`Mode : ${meta.method}`);
      break;
    case "discount_code_entered":
    case "discount_code_accepted":
    case "discount_code_rejected":
      if (typeof meta.code === "string") lines.push(`Code : ${meta.code}`);
      if (typeof meta.reason === "string") lines.push(`Motif : ${meta.reason}`);
      break;
    case "payment_step_reached":
      if (e.price != null) lines.push(`Montant : ${formatEUR(e.price)}`);
      if (typeof meta.cartCreatedAt === "string") lines.push("Panier créé avant la période");
      if (meta.cartUnknown) lines.push("Panier d'origine inconnue");
      break;
    case "checkout_completed":
    case "order_created":
    case "order_paid":
      if (e.price != null) lines.push(`Montant : ${formatEUR(e.price)}`);
      if (e.orderId) lines.push(`Commande : ${e.orderId}`);
      break;
    case "scroll_depth_reached":
      if (typeof meta.depth === "number") lines.push(`Profondeur : ${meta.depth}%`);
      break;
    case "search_submitted":
      if (e.term) lines.push(`Recherche : « ${e.term} »`);
      break;
    case "collection_viewed":
      if (typeof meta.collection === "string") lines.push(`Collection : ${meta.collection}`);
      break;
    case "utm_detected":
      lines.push(
        ["utm_source", "utm_medium", "utm_campaign"]
          .map((k) => meta[k])
          .filter(Boolean)
          .join(" / ")
      );
      break;
    case "referrer_detected":
      if (e.referrer) lines.push(e.referrer);
      if (typeof meta.note === "string") lines.push(meta.note);
      break;
    case "image_clicked":
      if (meta.image === "dimensions") lines.push("Image dimensions ouverte");
      break;
  }
  return lines.filter(Boolean);
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export type SourceKey =
  | "google_ads"
  | "meta_ads"
  | "tiktok_ads"
  | "seo"
  | "direct"
  | "email"
  | "referral"
  | "unknown";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  seo: "SEO",
  direct: "Direct",
  email: "Email",
  referral: "Referral",
  unknown: "Inconnue",
};

export function classifySource(source?: string, medium?: string): SourceKey {
  if (!source) return "unknown";
  if (source === "google" && medium === "cpc") return "google_ads";
  if ((source === "facebook" || source === "instagram") && medium === "paid") return "meta_ads";
  if (source === "tiktok" && medium === "paid") return "tiktok_ads";
  if (medium === "organic") return "seo";
  if (source === "direct") return "direct";
  if (medium === "email") return "email";
  if (medium === "referral" || source === "pinterest" || source === "instagram") return "referral";
  return "unknown";
}

export function formatSourceLabel(source?: string, medium?: string): string {
  const key = classifySource(source, medium);
  if (key === "unknown" && source) return source;
  return SOURCE_LABELS[key];
}
