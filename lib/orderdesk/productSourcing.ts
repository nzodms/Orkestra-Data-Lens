import { compareSuppliers, type CompareResult } from "./compare";
import type { DeskData } from "./types";

/**
 * Historique produit ↔ fournisseurs : synthèse de sourcing pour un produit
 * Shopify (offres connues, dernier prix reçu, meilleur prix historique,
 * fournisseur recommandé, statut).
 */

export type ProductSourcingStatus = "a_sourcer" | "stable" | "marge_faible" | "fournisseur_risque";

export const SOURCING_STATUS_LABELS: Record<ProductSourcingStatus, string> = {
  a_sourcer: "À sourcer",
  stable: "Stable",
  marge_faible: "Marge faible",
  fournisseur_risque: "Fournisseur risqué",
};

export type ProductSourcing = {
  productId: string;
  suppliersCount: number;
  currentSupplierId?: string;
  currentSupplierName?: string;
  currentCost?: number;
  lastQuotePrice?: number;
  lastQuoteAt?: string;
  bestHistoricalPrice?: number;
  avgLeadTimeDays?: number;
  marginPct?: number;
  linkedOrdersCount: number;
  status: ProductSourcingStatus;
  comparison: CompareResult;
};

export function computeProductSourcing(productId: string, clientPrice: number, desk: DeskData): ProductSourcing {
  const offers = desk.offers.filter((o) => o.productId === productId);
  const quotes = desk.quotes
    .filter((q) => q.productId === productId)
    .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
  const linkedOrders = desk.orders.filter((o) => o.lineItems.some((li) => li.productId === productId));

  const preferred = offers.find((o) => o.preferred) ?? offers[0];
  const currentSupplier = preferred ? desk.suppliers.find((s) => s.id === preferred.supplierId) : undefined;
  const currentCost = preferred ? preferred.productPrice + preferred.shippingPrice : undefined;

  const allTotals = [
    ...offers.map((o) => o.productPrice + o.shippingPrice),
    ...quotes.map((q) => q.productPrice + q.shippingPrice),
  ];
  const bestHistoricalPrice = allTotals.length > 0 ? Math.min(...allTotals) : undefined;

  const leads = offers.map((o) => o.leadTimeDays).filter((d): d is number => d != null);
  const avgLeadTimeDays = leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : undefined;

  const marginPct =
    currentCost != null && clientPrice > 0 ? Math.round(((clientPrice - currentCost) / clientPrice) * 100) : undefined;

  let status: ProductSourcingStatus = "stable";
  if (offers.length === 0) status = "a_sourcer";
  else if (currentSupplier && currentSupplier.reliabilityScore < 65) status = "fournisseur_risque";
  else if (marginPct != null && marginPct < 40) status = "marge_faible";

  return {
    productId,
    suppliersCount: new Set(offers.map((o) => o.supplierId)).size,
    currentSupplierId: currentSupplier?.id,
    currentSupplierName: currentSupplier?.name,
    currentCost,
    lastQuotePrice: quotes[0] ? quotes[0].productPrice + quotes[0].shippingPrice : undefined,
    lastQuoteAt: quotes[0]?.receivedAt,
    bestHistoricalPrice,
    avgLeadTimeDays,
    marginPct,
    linkedOrdersCount: linkedOrders.length,
    status,
    comparison: compareSuppliers(productId, clientPrice, 1, desk.suppliers, desk.offers),
  };
}
