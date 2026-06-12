import type { DeskData, Supplier } from "./types";

/**
 * Score & badges fournisseur, calculés depuis l'historique réel :
 * compétitivité prix, délai, fiabilité, taux et temps de réponse, problèmes.
 */

export type SupplierInsights = {
  quotesCount: number;
  messagesSent: number;
  responseRate: number; // %
  avgResponseHours: number | null;
  avgPrice: number | null;
  activeOrders: number;
  /** Part des produits où ce fournisseur a le meilleur prix total. */
  bestPriceShare: number;
  globalScore: number; // 0-100
  badges: SupplierBadge[];
};

export type SupplierBadge =
  | "Meilleur prix"
  | "Plus rapide"
  | "Fiable"
  | "Lent"
  | "À éviter"
  | "Nouveau fournisseur"
  | "À tester";

export function computeSupplierInsights(supplier: Supplier, data: DeskData): SupplierInsights {
  const quotes = data.quotes.filter((q) => q.supplierId === supplier.id);
  const messages = data.messages.filter((m) => m.supplierId === supplier.id);
  const sent = messages.filter((m) => m.sentAt);
  const replied = messages.filter((m) => m.replyAt || ["reply_received", "price_filled", "supplier_selected"].includes(m.status));
  const offers = data.offers.filter((o) => o.supplierId === supplier.id);

  const responseRate = sent.length === 0 ? 0 : Math.round((replied.length / sent.length) * 100);

  const responseTimes = messages
    .filter((m) => m.sentAt && m.replyAt)
    .map((m) => (new Date(m.replyAt!).getTime() - new Date(m.sentAt!).getTime()) / 3600000)
    .filter((h) => h >= 0);
  const avgResponseHours =
    responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;

  const prices = offers.map((o) => o.productPrice + o.shippingPrice);
  const avgPrice = prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  const activeOrders = data.orders.filter(
    (o) => o.supplierId === supplier.id && !["shipped", "sav"].includes(o.opsStatus)
  ).length;

  // Compétitivité : sur chaque produit où ce fournisseur a une offre, est-il le moins cher ?
  let bestCount = 0;
  let comparedCount = 0;
  for (const offer of offers) {
    const competing = data.offers.filter((o) => o.productId === offer.productId);
    if (competing.length < 2) continue;
    comparedCount++;
    const min = Math.min(...competing.map((o) => o.productPrice + o.shippingPrice));
    if (offer.productPrice + offer.shippingPrice === min) bestCount++;
  }
  const bestPriceShare = comparedCount === 0 ? 0 : Math.round((bestCount / comparedCount) * 100);

  // Score global pondéré
  const lead = supplier.avgLeadTimeDays ?? 15;
  const leadScore = Math.max(0, Math.min(100, 100 - (lead - 4) * 6)); // 4 j = 100, 20 j ≈ 4
  const problemScore = Math.max(0, 100 - supplier.problemRate * 6);
  const responseScore = sent.length === 0 ? 60 : responseRate; // pas encore de données → neutre
  const priceScore = comparedCount === 0 ? 60 : bestPriceShare;
  const globalScore = Math.round(
    supplier.reliabilityScore * 0.3 + priceScore * 0.2 + leadScore * 0.2 + responseScore * 0.15 + problemScore * 0.15
  );

  const badges: SupplierBadge[] = [];
  if (bestPriceShare >= 50 && comparedCount > 0) badges.push("Meilleur prix");
  if (lead <= 6) badges.push("Plus rapide");
  if (supplier.reliabilityScore >= 85 && supplier.problemRate <= 3) badges.push("Fiable");
  if (lead >= 15) badges.push("Lent");
  if (supplier.reliabilityScore < 65 || supplier.problemRate > 10) badges.push("À éviter");
  if (supplier.ordersCount < 3) badges.push("Nouveau fournisseur");
  if (quotes.length === 0 && messages.length === 0 && supplier.ordersCount === 0) badges.push("À tester");

  return {
    quotesCount: quotes.length,
    messagesSent: sent.length,
    responseRate,
    avgResponseHours,
    avgPrice,
    activeOrders,
    bestPriceShare,
    globalScore,
    badges,
  };
}
