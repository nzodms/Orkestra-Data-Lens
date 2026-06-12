import type { DeskOrder, Supplier, SupplierOffer } from "./types";

// ─── Comparaison fournisseurs & recommandation ───────────────────────────────

export type CompareRow = {
  supplier: Supplier;
  offer: SupplierOffer;
  totalPrice: number;
  leadTimeDays: number | null;
  stock: number | null;
  moq: number;
  reliability: number;
  estimatedMarginPct: number | null;
  /** Score recommandé 0-100 : prix, délai et fiabilité pondérés. */
  score: number;
  flags: { bestPrice: boolean; bestLeadTime: boolean; recommended: boolean; avoid: boolean };
};

export type CompareResult = {
  rows: CompareRow[];
  recommendation: string | null;
  recommended?: CompareRow;
};

const RELIABILITY_FLOOR = 65; // sous ce seuil : « à éviter »

export function compareSuppliers(
  productId: string,
  clientPrice: number,
  quantity: number,
  suppliers: Supplier[],
  offers: SupplierOffer[]
): CompareResult {
  const productOffers = offers.filter((o) => o.productId === productId);
  if (productOffers.length === 0) return { rows: [], recommendation: null };

  const draft = productOffers
    .map((offer) => {
      const supplier = suppliers.find((s) => s.id === offer.supplierId);
      if (!supplier) return null;
      const totalPrice = (offer.productPrice + offer.shippingPrice) * quantity;
      const marginPct =
        clientPrice > 0 ? Math.round(((clientPrice - totalPrice) / clientPrice) * 100) : null;
      return {
        supplier,
        offer,
        totalPrice: Math.round(totalPrice * 100) / 100,
        leadTimeDays: offer.leadTimeDays ?? supplier.avgLeadTimeDays ?? null,
        stock: offer.stock ?? null,
        moq: offer.moq,
        reliability: supplier.reliabilityScore,
        estimatedMarginPct: marginPct,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (draft.length === 0) return { rows: [], recommendation: null };

  const minPrice = Math.min(...draft.map((r) => r.totalPrice));
  const maxPrice = Math.max(...draft.map((r) => r.totalPrice));
  const leadTimes = draft.map((r) => r.leadTimeDays).filter((d): d is number => d != null);
  const minLead = leadTimes.length > 0 ? Math.min(...leadTimes) : null;
  const maxLead = leadTimes.length > 0 ? Math.max(...leadTimes) : null;

  const rows: CompareRow[] = draft.map((r) => {
    // Normalisations 0-1 (1 = meilleur)
    const priceScore = maxPrice === minPrice ? 1 : 1 - (r.totalPrice - minPrice) / (maxPrice - minPrice);
    const leadScore =
      r.leadTimeDays == null || minLead == null || maxLead == null || maxLead === minLead
        ? 0.5
        : 1 - (r.leadTimeDays - minLead) / (maxLead - minLead);
    const reliabilityScore = r.reliability / 100;
    const score = Math.round((priceScore * 0.45 + leadScore * 0.25 + reliabilityScore * 0.3) * 100);
    return {
      ...r,
      score,
      flags: {
        bestPrice: r.totalPrice === minPrice,
        bestLeadTime: minLead != null && r.leadTimeDays === minLead,
        recommended: false,
        avoid: r.reliability < RELIABILITY_FLOOR,
      },
    };
  });

  rows.sort((a, b) => b.score - a.score);

  // Recommandé : meilleur score parmi les fournisseurs fiables
  const recommended = rows.find((r) => !r.flags.avoid) ?? rows[0];
  recommended.flags.recommended = true;

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
  const recommendation = `Fournisseur recommandé : ${recommended.supplier.name} — prix total ${fmt(recommended.totalPrice)}, délai ${
    recommended.leadTimeDays != null ? `${recommended.leadTimeDays} jours` : "inconnu"
  }${recommended.estimatedMarginPct != null ? `, marge estimée ${recommended.estimatedMarginPct} %` : ""}, fiabilité ${recommended.reliability}/100.`;

  return { rows, recommendation, recommended };
}

/** Comparaison pour le premier produit d'une commande. */
export function compareForOrder(
  order: DeskOrder,
  suppliers: Supplier[],
  offers: SupplierOffer[]
): CompareResult & { productId?: string } {
  const line = order.lineItems.find((li) => li.productId);
  if (!line?.productId) return { rows: [], recommendation: null };
  return {
    ...compareSuppliers(line.productId, order.totalPrice, line.quantity, suppliers, offers),
    productId: line.productId,
  };
}
