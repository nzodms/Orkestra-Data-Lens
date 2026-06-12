// ─── Types Order Desk (partagés client/serveur, sérialisables) ───────────────

export type OpsStatus =
  | "todo"
  | "sourcing"
  | "price_compare"
  | "supplier_chosen"
  | "message_sent"
  | "payment_pending"
  | "ordered"
  | "tracking_pending"
  | "shipped"
  | "problem"
  | "sav";

export const OPS_STATUS_LABELS: Record<OpsStatus, string> = {
  todo: "À traiter",
  sourcing: "Recherche fournisseur",
  price_compare: "Prix à comparer",
  supplier_chosen: "Fournisseur choisi",
  message_sent: "Message envoyé",
  payment_pending: "Paiement fournisseur en attente",
  ordered: "Commande fournisseur passée",
  tracking_pending: "Tracking en attente",
  shipped: "Expédiée",
  problem: "Problème fournisseur",
  sav: "SAV / remboursement",
};

export const OPS_STATUS_ORDER: OpsStatus[] = [
  "todo",
  "sourcing",
  "price_compare",
  "supplier_chosen",
  "message_sent",
  "payment_pending",
  "ordered",
  "tracking_pending",
  "shipped",
  "problem",
  "sav",
];

export type KanbanColumn = {
  key: string;
  label: string;
  statuses: OpsStatus[];
  tone: "neutral" | "blue" | "orange" | "green" | "red" | "violet";
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: "todo", label: "Nouvelle commande", statuses: ["todo"], tone: "red" },
  { key: "sourcing", label: "À sourcer", statuses: ["sourcing"], tone: "orange" },
  { key: "contacted", label: "Fournisseur contacté", statuses: ["message_sent"], tone: "blue" },
  { key: "priced", label: "Prix reçu", statuses: ["price_compare"], tone: "violet" },
  { key: "chosen", label: "Fournisseur choisi", statuses: ["supplier_chosen"], tone: "blue" },
  { key: "payment", label: "Paiement fournisseur", statuses: ["payment_pending"], tone: "violet" },
  { key: "tracking", label: "Tracking attendu", statuses: ["ordered", "tracking_pending"], tone: "orange" },
  { key: "shipped", label: "Expédiée", statuses: ["shipped"], tone: "green" },
  { key: "problem", label: "Problème", statuses: ["problem", "sav"], tone: "red" },
];

export const NEXT_ACTIONS: Record<OpsStatus, string> = {
  todo: "Choisir ou rechercher un fournisseur",
  sourcing: "Demander les prix aux fournisseurs",
  price_compare: "Comparer les offres et choisir",
  supplier_chosen: "Envoyer la commande au fournisseur",
  message_sent: "Attendre la réponse, relancer si besoin",
  payment_pending: "Payer le fournisseur",
  ordered: "Attendre le tracking",
  tracking_pending: "Demander le tracking au fournisseur",
  shipped: "Suivi en cours — rien à faire",
  problem: "Traiter le problème fournisseur",
  sav: "Gérer le SAV / remboursement client",
};

/** Délai (jours) au-delà duquel une commande est considérée en retard, par statut. */
export const LATE_AFTER_DAYS: Partial<Record<OpsStatus, number>> = {
  todo: 1,
  sourcing: 2,
  price_compare: 2,
  supplier_chosen: 1,
  message_sent: 2,
  payment_pending: 1,
  ordered: 5,
  tracking_pending: 3,
};

export type SupplierTag = "rapide" | "fiable" | "cher" | "bon prix" | "fragile" | "à éviter";

export type Supplier = {
  id: string;
  name: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  country?: string;
  currency: string;
  avgLeadTimeDays?: number;
  reliabilityScore: number;
  ordersCount: number;
  problemRate: number;
  lastContactAt?: string;
  notes?: string;
  tags: SupplierTag[];
};

/** Offre de référence produit → fournisseur. */
export type SupplierOffer = {
  id: string;
  supplierId: string;
  productId: string; // ID produit Shopify (ou démo)
  productTitle?: string;
  productPrice: number;
  shippingPrice: number;
  leadTimeDays?: number;
  moq: number;
  stock?: number;
  productUrl?: string;
  note?: string;
  preferred: boolean;
};

export type SupplierQuote = {
  id: string;
  supplierId: string;
  orderId?: string;
  productId?: string;
  productPrice: number;
  shippingPrice: number;
  leadTimeDays?: number;
  status: "requested" | "received" | "selected" | "rejected";
  note?: string;
  receivedAt?: string;
};

export type MessageStatus = "prepared" | "sent_manual" | "reply_received" | "price_filled" | "supplier_selected";

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  prepared: "Message préparé",
  sent_manual: "Envoyé manuellement",
  reply_received: "Réponse reçue",
  price_filled: "Prix renseigné",
  supplier_selected: "Fournisseur retenu",
};

export type SupplierMessage = {
  id: string;
  supplierId: string;
  supplierName?: string;
  orderId?: string;
  orderNumber?: string;
  templateKey: string;
  body: string;
  status: MessageStatus;
  preparedAt: string;
  sentAt?: string;
  replyAt?: string;
};

export type InternalNote = {
  id: string;
  entityType: "order" | "supplier" | "product";
  entityId: string;
  body: string;
  createdAt: string;
};

export type DeskLineItem = {
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  productId?: string;
};

/** Vue commande pour l'Order Desk (Shopify + état opérationnel). */
export type DeskOrder = {
  id: string; // id interne (uuid en live, id démo sinon)
  orderNumber: string;
  createdAt: string;
  customerMasked?: string;
  country?: string;
  totalPrice: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus?: string;
  lineItems: DeskLineItem[];
  opsStatus: OpsStatus;
  supplierId?: string;
  supplierCost?: number;
  trackingNumber?: string;
  trackingCarrier?: string;
  problemNote?: string;
};

export type DeskData = {
  orders: DeskOrder[];
  suppliers: Supplier[];
  offers: SupplierOffer[];
  quotes: SupplierQuote[];
  messages: SupplierMessage[];
  notes: InternalNote[];
  activities: import("@/lib/activity").ActivityLog[];
};

// ─── Helpers dérivés ──────────────────────────────────────────────────────────

export function estimatedMarginPct(order: DeskOrder, offers: SupplierOffer[]): number | null {
  let cost = order.supplierCost ?? null;
  if (cost == null) {
    // Coût estimé à partir de la meilleure offre des produits de la commande
    let total = 0;
    let covered = false;
    for (const li of order.lineItems) {
      if (!li.productId) continue;
      const productOffers = offers.filter((o) => o.productId === li.productId);
      if (productOffers.length === 0) continue;
      const best = productOffers.reduce((a, b) =>
        a.productPrice + a.shippingPrice <= b.productPrice + b.shippingPrice ? a : b
      );
      total += (best.productPrice + best.shippingPrice) * li.quantity;
      covered = true;
    }
    if (!covered) return null;
    cost = total;
  }
  if (order.totalPrice <= 0) return null;
  return Math.round(((order.totalPrice - cost) / order.totalPrice) * 100);
}

export function isLate(order: DeskOrder, now = Date.now()): boolean {
  const limit = LATE_AFTER_DAYS[order.opsStatus];
  if (limit == null) return false;
  const ageDays = (now - new Date(order.createdAt).getTime()) / 86400000;
  return ageDays > limit + (order.opsStatus === "ordered" ? 0 : 0);
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));
}
