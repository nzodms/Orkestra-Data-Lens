import type { DeskAction } from "@/lib/orderdesk/actions";
import type {
  DeskData,
  DeskOrder,
  InternalNote,
  OpsStatus,
  Supplier,
  SupplierMessage,
  SupplierOffer,
  SupplierQuote,
} from "@/lib/orderdesk/types";
import { at } from "@/lib/utils";
import { getDataset } from "./dataset";
import { productById } from "./products";

/**
 * Order Desk — données de démonstration.
 *
 * Construites à partir des commandes du dataset démo (mêmes numéros, mêmes
 * montants) avec un parc fournisseurs réaliste pour une boutique de
 * luminaires. Store mutable en mémoire : les actions (assigner, statut,
 * messages…) fonctionnent réellement en mode démo, mais ne sont pas
 * persistées (réinitialisées au redémarrage du serveur).
 */

let seq = 1000;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

// ─── Fournisseurs ─────────────────────────────────────────────────────────────

const SUPPLIERS: Supplier[] = [
  {
    id: "sup_lightpro",
    name: "Shenzhen LightPro",
    whatsapp: "+86 138 0013 8000",
    email: "sales@lightpro-sz.com",
    website: "https://lightpro-sz.com",
    country: "CN",
    currency: "USD",
    avgLeadTimeDays: 9,
    reliabilityScore: 91,
    ordersCount: 34,
    problemRate: 2.9,
    lastContactAt: at(1, "10:24:00"),
    notes: "Très réactif sur WhatsApp. Accepte les commandes à l'unité.",
    tags: ["rapide", "fiable"],
  },
  {
    id: "sup_lumina",
    name: "Foshan Lumina Factory",
    whatsapp: "+86 139 2244 5566",
    email: "contact@lumina-fs.cn",
    website: "https://lumina-fs.cn",
    country: "CN",
    currency: "USD",
    avgLeadTimeDays: 12,
    reliabilityScore: 84,
    ordersCount: 21,
    problemRate: 4.8,
    lastContactAt: at(3, "15:02:00"),
    notes: "Bon rapport qualité/prix sur les suspensions.",
    tags: ["bon prix"],
  },
  {
    id: "sup_bright",
    name: "Guangzhou BrightSource",
    whatsapp: "+86 135 7788 9900",
    email: "exports@brightsource-gz.com",
    country: "CN",
    currency: "USD",
    avgLeadTimeDays: 8,
    reliabilityScore: 76,
    ordersCount: 12,
    problemRate: 8.3,
    lastContactAt: at(4, "09:40:00"),
    notes: "Rapide mais emballage fragile sur le verre : exiger double carton.",
    tags: ["rapide", "fragile"],
  },
  {
    id: "sup_crystal",
    name: "HK Crystal Works",
    whatsapp: "+852 9123 4567",
    email: "orders@hkcrystalworks.hk",
    website: "https://hkcrystalworks.hk",
    country: "HK",
    currency: "USD",
    avgLeadTimeDays: 15,
    reliabilityScore: 88,
    ordersCount: 9,
    problemRate: 0,
    lastContactAt: at(6, "11:15:00"),
    notes: "Spécialiste cristal haut de gamme. Plus cher mais zéro litige.",
    tags: ["cher", "fiable"],
  },
  {
    id: "sup_eurolum",
    name: "EuroLum Distribution",
    whatsapp: "+31 6 1234 5678",
    email: "b2b@eurolum.nl",
    website: "https://eurolum.nl",
    country: "NL",
    currency: "EUR",
    avgLeadTimeDays: 4,
    reliabilityScore: 95,
    ordersCount: 17,
    problemRate: 1.2,
    lastContactAt: at(2, "16:48:00"),
    notes: "Stock UE : délais courts, idéal pour les commandes urgentes.",
    tags: ["rapide", "fiable", "cher"],
  },
  {
    id: "sup_yiwu",
    name: "Yiwu Deco Direct",
    whatsapp: "+86 130 5566 7788",
    country: "CN",
    currency: "USD",
    avgLeadTimeDays: 18,
    reliabilityScore: 58,
    ordersCount: 6,
    problemRate: 16.7,
    lastContactAt: at(12, "08:30:00"),
    notes: "Prix très bas mais 2 litiges sur 6 commandes. À éviter sur le fragile.",
    tags: ["bon prix", "à éviter"],
  },
];

// ─── Offres produit → fournisseur (prix en EUR pour comparaison directe) ─────

const offer = (
  supplierId: string,
  productId: string,
  productPrice: number,
  shippingPrice: number,
  leadTimeDays: number,
  extra?: Partial<SupplierOffer>
): SupplierOffer => ({
  id: nextId("off"),
  supplierId,
  productId,
  productTitle: productById(productId)?.title,
  productPrice,
  shippingPrice,
  leadTimeDays,
  moq: 1,
  preferred: false,
  ...extra,
});

const OFFERS: SupplierOffer[] = [
  // p1 — Lustre Cristal Moderne (prix client 189,99 €)
  offer("sup_lightpro", "p1", 48.0, 12.5, 9, { stock: 120, preferred: true, productUrl: "https://lightpro-sz.com/p/crystal-chandelier-60" }),
  offer("sup_lumina", "p1", 44.2, 15.0, 12, { stock: 60 }),
  offer("sup_crystal", "p1", 66.0, 18.0, 15, { stock: 200, note: "Cristal K9 véritable" }),
  offer("sup_eurolum", "p1", 82.0, 6.5, 4, { stock: 14 }),
  offer("sup_yiwu", "p1", 38.5, 14.0, 18, { stock: 300 }),
  // p2 — Suspension Verre Fumé (129 €)
  offer("sup_lumina", "p2", 27.8, 9.5, 12, { stock: 90, preferred: true }),
  offer("sup_bright", "p2", 25.4, 11.0, 8, { stock: 45, note: "Emballage à surveiller (verre)" }),
  offer("sup_eurolum", "p2", 46.0, 5.5, 4, { stock: 22 }),
  // p3 — Plafonnier LED Design (89,90 €)
  offer("sup_lightpro", "p3", 19.6, 8.0, 9, { stock: 250, preferred: true }),
  offer("sup_bright", "p3", 17.9, 9.0, 8, { stock: 110 }),
  offer("sup_yiwu", "p3", 14.2, 10.5, 18, { stock: 500 }),
  // p4 — Lampe de Chevet Dorée (59,90 €)
  offer("sup_lumina", "p4", 12.4, 6.5, 12, { stock: 180, preferred: true }),
  offer("sup_yiwu", "p4", 9.8, 7.0, 18, { stock: 400 }),
  offer("sup_eurolum", "p4", 21.0, 4.5, 4, { stock: 35 }),
  // p5 — Applique Murale Noire (49,90 €)
  offer("sup_bright", "p5", 9.6, 6.0, 8, { stock: 220, preferred: true }),
  offer("sup_lumina", "p5", 10.2, 5.5, 12, { stock: 150 }),
  // p6 — Suspension Rotin Naturel (99 €)
  offer("sup_lightpro", "p6", 24.5, 11.0, 9, { stock: 80, preferred: true }),
  offer("sup_crystal", "p6", 31.0, 12.0, 15, { stock: 40 }),
  offer("sup_yiwu", "p6", 18.9, 12.5, 18, { stock: 260, note: "Qualité tressage irrégulière" }),
];

// ─── Commandes : statuts opérationnels répartis sur le cycle ─────────────────

const STATUS_PATTERN: OpsStatus[] = [
  "todo",
  "todo",
  "sourcing",
  "price_compare",
  "message_sent",
  "supplier_chosen",
  "payment_pending",
  "ordered",
  "tracking_pending",
  "shipped",
  "shipped",
  "problem",
  "ordered",
  "message_sent",
  "todo",
];

const MASKED_CUSTOMERS = [
  "m***@gmail.com", "s***@hotmail.fr", "c***@orange.fr", "l***@gmail.com", "a***@outlook.com",
  "j***@gmail.com", "p***@free.fr", "n***@icloud.com", "e***@gmail.com", "v***@laposte.net",
  "t***@gmail.com", "f***@hotmail.com", "d***@gmail.com", "b***@sfr.fr", "r***@gmail.com",
];

function buildOrders(): DeskOrder[] {
  const dataset = getDataset();
  const orders = [...dataset.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return orders.map((o, i) => {
    const opsStatus = STATUS_PATTERN[i % STATUS_PATTERN.length];
    const productId = o.productIds[0];
    const product = productId ? productById(productId) : undefined;
    const quantity = product ? Math.max(1, Math.round(o.totalPrice / product.priceMin)) : 1;

    const lineItems = o.productIds.map((pid) => {
      const p = productById(pid);
      return {
        title: p?.title ?? "Produit",
        variantTitle: undefined,
        quantity,
        price: p?.priceMin ?? o.totalPrice,
        productId: pid,
      };
    });

    // Fournisseur déjà choisi pour les étapes avancées
    const advanced = !["todo", "sourcing", "price_compare"].includes(opsStatus);
    const preferredOffer = productId ? OFFERS.find((of) => of.productId === productId && of.preferred) : undefined;
    const supplierId = advanced ? preferredOffer?.supplierId : undefined;
    const supplierCost = advanced && preferredOffer ? (preferredOffer.productPrice + preferredOffer.shippingPrice) * quantity : undefined;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      customerMasked: MASKED_CUSTOMERS[i % MASKED_CUSTOMERS.length],
      country: o.country ?? "FR",
      totalPrice: o.totalPrice,
      currency: o.currency,
      financialStatus: o.financialStatus,
      fulfillmentStatus: opsStatus === "shipped" ? "fulfilled" : "unfulfilled",
      lineItems,
      opsStatus,
      supplierId,
      supplierCost: supplierCost != null ? Math.round(supplierCost * 100) / 100 : undefined,
      trackingNumber: opsStatus === "shipped" ? `YT${2026000000 + i * 7919}FR` : undefined,
      trackingCarrier: opsStatus === "shipped" ? "Yun Express" : undefined,
      problemNote: opsStatus === "problem" ? "Colis endommagé à l'arrivée (verre cassé). Renvoi demandé au fournisseur." : undefined,
    };
  });
}

// ─── Messages & devis de démonstration ───────────────────────────────────────

function buildMessagesAndQuotes(orders: DeskOrder[]): { messages: SupplierMessage[]; quotes: SupplierQuote[] } {
  const messages: SupplierMessage[] = [];
  const quotes: SupplierQuote[] = [];

  const compareOrder = orders.find((o) => o.opsStatus === "price_compare");
  if (compareOrder) {
    const pid = compareOrder.lineItems[0]?.productId;
    const candidates = OFFERS.filter((of) => of.productId === pid).slice(0, 3);
    candidates.forEach((of, i) => {
      const replied = i < 2;
      messages.push({
        id: nextId("msg"),
        supplierId: of.supplierId,
        supplierName: SUPPLIERS.find((s) => s.id === of.supplierId)?.name,
        orderId: compareOrder.id,
        orderNumber: compareOrder.orderNumber,
        templateKey: "price_availability",
        body: `Bonjour, pouvez-vous me confirmer le meilleur prix, la disponibilité et le délai de livraison pour ce produit ?\nProduit : ${compareOrder.lineItems[0]?.title}\nQuantité : ${compareOrder.lineItems[0]?.quantity}\nPays de livraison : ${compareOrder.country}\nMerci.`,
        status: replied ? "price_filled" : "sent_manual",
        preparedAt: at(1, `1${i}:0${i * 3}:00`),
        sentAt: at(1, `1${i}:1${i}:00`),
        replyAt: replied ? at(0, `09:2${i}:00`) : undefined,
      });
      if (replied) {
        quotes.push({
          id: nextId("qt"),
          supplierId: of.supplierId,
          orderId: compareOrder.id,
          productId: pid,
          productPrice: of.productPrice,
          shippingPrice: of.shippingPrice,
          leadTimeDays: of.leadTimeDays,
          status: "received",
          receivedAt: at(0, `09:2${i}:00`),
        });
      }
    });
  }

  // Messages « envoyé, sans réponse depuis 3 jours » → relance à faire
  const sentOrders = orders.filter((o) => o.opsStatus === "message_sent");
  sentOrders.forEach((o, i) => {
    const supplierId = o.supplierId ?? OFFERS.find((of) => of.productId === o.lineItems[0]?.productId)?.supplierId ?? "sup_lightpro";
    messages.push({
      id: nextId("msg"),
      supplierId,
      supplierName: SUPPLIERS.find((s) => s.id === supplierId)?.name,
      orderId: o.id,
      orderNumber: o.orderNumber,
      templateKey: i === 0 ? "order_confirmation" : "price_availability",
      body: `Bonjour, je confirme la commande suivante :\nProduit : ${o.lineItems[0]?.title}\nQuantité : ${o.lineItems[0]?.quantity}\nRéférence interne : ${o.orderNumber}\nMerci de me confirmer la réception.`,
      status: "sent_manual",
      preparedAt: at(3, "14:05:00"),
      sentAt: at(3, "14:12:00"),
    });
  });

  // Tracking demandé hier pour la commande en attente de tracking
  const trackingOrder = orders.find((o) => o.opsStatus === "tracking_pending");
  if (trackingOrder?.supplierId) {
    messages.push({
      id: nextId("msg"),
      supplierId: trackingOrder.supplierId,
      supplierName: SUPPLIERS.find((s) => s.id === trackingOrder.supplierId)?.name,
      orderId: trackingOrder.id,
      orderNumber: trackingOrder.orderNumber,
      templateKey: "tracking_request",
      body: `Bonjour, pouvez-vous m'envoyer le numéro de tracking pour cette commande ?\nRéférence interne : ${trackingOrder.orderNumber}\nMerci.`,
      status: "reply_received",
      preparedAt: at(1, "17:30:00"),
      sentAt: at(1, "17:31:00"),
      replyAt: at(0, "08:05:00"),
    });
  }

  return { messages, quotes };
}

const DEMO_NOTES: InternalNote[] = [
  {
    id: nextId("note"),
    entityType: "supplier",
    entityId: "sup_yiwu",
    body: "2 colis cassés en mai. Ne plus utiliser pour le verre, uniquement rotin/métal.",
    createdAt: at(5, "10:12:00"),
  },
];

// ─── Store mutable (mode démo) ────────────────────────────────────────────────

let store: DeskData | null = null;
let storeDay: string | null = null;

export function getDemoDeskData(): DeskData {
  const today = new Date().toDateString();
  if (store && storeDay === today) return store;
  const orders = buildOrders();
  const { messages, quotes } = buildMessagesAndQuotes(orders);
  store = {
    orders,
    suppliers: SUPPLIERS.map((s) => ({ ...s })),
    offers: OFFERS.map((o) => ({ ...o })),
    quotes,
    messages,
    notes: [...DEMO_NOTES],
  };
  storeDay = today;
  return store;
}

/** Applique une action au store démo (non persisté). */
export function applyDemoDeskAction(action: DeskAction): { ok: boolean; id?: string } {
  const data = getDemoDeskData();
  const order = "orderId" in action && action.orderId ? data.orders.find((o) => o.id === action.orderId) : undefined;

  switch (action.type) {
    case "set_status": {
      if (!order) return { ok: false };
      order.opsStatus = action.status;
      return { ok: true };
    }
    case "assign_supplier": {
      if (!order) return { ok: false };
      order.supplierId = action.supplierId;
      if (action.cost != null) order.supplierCost = action.cost;
      if (["todo", "sourcing", "price_compare"].includes(order.opsStatus)) order.opsStatus = "supplier_chosen";
      return { ok: true };
    }
    case "set_tracking": {
      if (!order) return { ok: false };
      order.trackingNumber = action.tracking;
      order.trackingCarrier = action.carrier;
      order.opsStatus = "shipped";
      return { ok: true };
    }
    case "report_problem": {
      if (!order) return { ok: false };
      order.opsStatus = "problem";
      order.problemNote = action.note;
      return { ok: true };
    }
    case "add_note": {
      const id = nextId("note");
      data.notes.unshift({
        id,
        entityType: action.entityType,
        entityId: action.entityId,
        body: action.body,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, id };
    }
    case "record_message": {
      const id = nextId("msg");
      const supplier = data.suppliers.find((s) => s.id === action.supplierId);
      const linkedOrder = data.orders.find((o) => o.id === action.orderId);
      data.messages.unshift({
        id,
        supplierId: action.supplierId,
        supplierName: supplier?.name,
        orderId: action.orderId,
        orderNumber: linkedOrder?.orderNumber,
        templateKey: action.templateKey,
        body: action.body,
        status: action.status,
        preparedAt: new Date().toISOString(),
        sentAt: action.status === "sent_manual" ? new Date().toISOString() : undefined,
      });
      if (supplier) supplier.lastContactAt = new Date().toISOString();
      if (linkedOrder && ["todo", "sourcing", "supplier_chosen"].includes(linkedOrder.opsStatus)) {
        linkedOrder.opsStatus = "message_sent";
      }
      return { ok: true, id };
    }
    case "update_message": {
      const msg = data.messages.find((m) => m.id === action.messageId);
      if (!msg) return { ok: false };
      msg.status = action.status;
      if (action.status === "sent_manual" && !msg.sentAt) msg.sentAt = new Date().toISOString();
      if (action.status === "reply_received" && !msg.replyAt) msg.replyAt = new Date().toISOString();
      return { ok: true };
    }
    case "add_quote": {
      const id = nextId("qt");
      data.quotes.unshift({
        id,
        supplierId: action.supplierId,
        orderId: action.orderId,
        productId: action.productId,
        productPrice: action.productPrice,
        shippingPrice: action.shippingPrice,
        leadTimeDays: action.leadTimeDays,
        status: "received",
        receivedAt: new Date().toISOString(),
      });
      if (action.messageId) {
        const msg = data.messages.find((m) => m.id === action.messageId);
        if (msg) msg.status = "price_filled";
      }
      // Met aussi à jour l'offre de référence du produit
      if (action.productId) {
        const existing = data.offers.find(
          (o) => o.supplierId === action.supplierId && o.productId === action.productId
        );
        if (existing) {
          existing.productPrice = action.productPrice;
          existing.shippingPrice = action.shippingPrice;
          if (action.leadTimeDays != null) existing.leadTimeDays = action.leadTimeDays;
        } else {
          data.offers.push({
            id: nextId("off"),
            supplierId: action.supplierId,
            productId: action.productId,
            productTitle: productById(action.productId)?.title,
            productPrice: action.productPrice,
            shippingPrice: action.shippingPrice,
            leadTimeDays: action.leadTimeDays,
            moq: 1,
            preferred: false,
          });
        }
      }
      return { ok: true, id };
    }
    case "upsert_supplier": {
      const input = action.supplier;
      const existing = input.id ? data.suppliers.find((s) => s.id === input.id) : undefined;
      if (existing) {
        Object.assign(existing, {
          ...input,
          tags: input.tags ?? existing.tags,
          currency: input.currency ?? existing.currency,
          reliabilityScore: input.reliabilityScore ?? existing.reliabilityScore,
        });
        return { ok: true, id: existing.id };
      }
      const id = nextId("sup");
      data.suppliers.push({
        id,
        name: input.name,
        whatsapp: input.whatsapp,
        email: input.email,
        website: input.website,
        country: input.country,
        currency: input.currency ?? "USD",
        avgLeadTimeDays: input.avgLeadTimeDays,
        reliabilityScore: input.reliabilityScore ?? 80,
        ordersCount: 0,
        problemRate: 0,
        notes: input.notes,
        tags: input.tags ?? [],
      });
      return { ok: true, id };
    }
    case "add_offer": {
      const id = nextId("off");
      data.offers.push({
        id,
        supplierId: action.supplierId,
        productId: action.productId,
        productTitle: productById(action.productId)?.title,
        productPrice: action.productPrice,
        shippingPrice: action.shippingPrice,
        leadTimeDays: action.leadTimeDays,
        moq: action.moq ?? 1,
        stock: action.stock,
        productUrl: action.productUrl,
        preferred: action.preferred ?? false,
      });
      return { ok: true, id };
    }
  }
}
