import type { DeskData, DeskOrder } from "./types";
import { daysSince } from "./types";

// ─── « À faire maintenant » ───────────────────────────────────────────────────

export type TodoItem = {
  id: string;
  label: string;
  count: number;
  tone: "red" | "orange" | "violet" | "blue";
  detail: string;
  /** Clé de filtre à appliquer dans la vue commandes. */
  filterKey?: string;
};

const RESOURCE_MARGIN_FLOOR = 40; // % : sous ce seuil, re-sourcer le produit

export function buildTodoList(data: DeskData): TodoItem[] {
  const items: TodoItem[] = [];

  const noSupplier = data.orders.filter(
    (o) => ["todo", "sourcing", "price_compare"].includes(o.opsStatus) && !o.supplierId
  );
  if (noSupplier.length > 0) {
    items.push({
      id: "no_supplier",
      label: `${noSupplier.length} commande${noSupplier.length > 1 ? "s" : ""} sans fournisseur`,
      count: noSupplier.length,
      tone: "red",
      detail: noSupplier
        .slice(0, 3)
        .map((o) => o.orderNumber)
        .join(", "),
      filterKey: "unassigned",
    });
  }

  // Fournisseurs à relancer : message envoyé il y a plus de 2 jours sans réponse
  const staleSuppliers = new Set(
    data.messages
      .filter((m) => m.status === "sent_manual" && m.sentAt && daysSince(m.sentAt) >= 2)
      .map((m) => m.supplierId)
  );
  if (staleSuppliers.size > 0) {
    const names = [...staleSuppliers]
      .map((id) => data.suppliers.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3);
    items.push({
      id: "follow_up",
      label: `${staleSuppliers.size} fournisseur${staleSuppliers.size > 1 ? "s" : ""} à relancer`,
      count: staleSuppliers.size,
      tone: "orange",
      detail: `Sans réponse depuis 2 j+ : ${names.join(", ")}`,
      filterKey: "message_sent",
    });
  }

  const paymentPending = data.orders.filter((o) => o.opsStatus === "payment_pending");
  if (paymentPending.length > 0) {
    items.push({
      id: "payment",
      label: `${paymentPending.length} paiement${paymentPending.length > 1 ? "s" : ""} fournisseur en attente`,
      count: paymentPending.length,
      tone: "violet",
      detail: paymentPending.map((o) => o.orderNumber).slice(0, 3).join(", "),
      filterKey: "payment_pending",
    });
  }

  const noTracking = data.orders.filter(
    (o) => (o.opsStatus === "ordered" || o.opsStatus === "tracking_pending") && !o.trackingNumber
  );
  if (noTracking.length > 0) {
    items.push({
      id: "tracking",
      label: `${noTracking.length} commande${noTracking.length > 1 ? "s" : ""} sans tracking`,
      count: noTracking.length,
      tone: "blue",
      detail: noTracking.map((o) => o.orderNumber).slice(0, 4).join(", "),
      filterKey: "tracking",
    });
  }

  // Produits à re-sourcer : meilleure offre connue → marge < seuil
  const productMargins = new Map<string, { title: string; margin: number }>();
  for (const order of data.orders) {
    for (const li of order.lineItems) {
      if (!li.productId || li.price <= 0) continue;
      const productOffers = data.offers.filter((o) => o.productId === li.productId);
      if (productOffers.length === 0) continue;
      const best = Math.min(...productOffers.map((o) => o.productPrice + o.shippingPrice));
      const margin = Math.round(((li.price - best) / li.price) * 100);
      productMargins.set(li.productId, { title: li.title, margin });
    }
  }
  const toResource = [...productMargins.values()].filter((p) => p.margin < RESOURCE_MARGIN_FLOOR);
  if (toResource.length > 0) {
    items.push({
      id: "resource",
      label: `${toResource.length} produit${toResource.length > 1 ? "s" : ""} à re-sourcer (marge trop basse)`,
      count: toResource.length,
      tone: "orange",
      detail: toResource.map((p) => `${p.title} (${p.margin}%)`).slice(0, 2).join(", "),
    });
  }

  const problems = data.orders.filter((o) => o.opsStatus === "problem" || o.opsStatus === "sav");
  if (problems.length > 0) {
    items.push({
      id: "problems",
      label: `${problems.length} problème${problems.length > 1 ? "s" : ""} fournisseur`,
      count: problems.length,
      tone: "red",
      detail: problems.map((o) => o.orderNumber).slice(0, 3).join(", "),
      filterKey: "problem",
    });
  }

  return items;
}

export function ordersForFilterKey(orders: DeskOrder[], key: string): DeskOrder[] {
  switch (key) {
    case "unassigned":
      return orders.filter((o) => ["todo", "sourcing", "price_compare"].includes(o.opsStatus) && !o.supplierId);
    case "message_sent":
      return orders.filter((o) => o.opsStatus === "message_sent");
    case "payment_pending":
      return orders.filter((o) => o.opsStatus === "payment_pending");
    case "tracking":
      return orders.filter((o) => (o.opsStatus === "ordered" || o.opsStatus === "tracking_pending") && !o.trackingNumber);
    case "problem":
      return orders.filter((o) => o.opsStatus === "problem" || o.opsStatus === "sav");
    default:
      return orders;
  }
}
