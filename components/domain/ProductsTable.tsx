"use client";

import { useState } from "react";
import { Award, ExternalLink, Factory, Lightbulb, Wrench } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/ui/Toaster";
import { useDeskAction } from "@/components/orderdesk/useDeskAction";
import { PRODUCT_CATEGORY_LABELS, type ProductCategory, type ProductStats } from "@/lib/analytics";
import { SOURCING_STATUS_LABELS, type ProductSourcing } from "@/lib/orderdesk/productSourcing";
import { fillTemplate, templateByKey, waLink } from "@/lib/orderdesk/templates";
import type { Supplier } from "@/lib/orderdesk/types";
import { formatDate, formatEUR, formatNumber, formatPct } from "@/lib/utils";

const SOURCING_TONES: Record<ProductSourcing["status"], BadgeTone> = {
  a_sourcer: "orange",
  stable: "green",
  marge_faible: "red",
  fournisseur_risque: "red",
};

export const CATEGORY_TONES: Record<ProductCategory, BadgeTone> = {
  scaler: "green",
  ameliorer: "orange",
  bloque_checkout: "red",
  suspect: "violet",
  couper: "neutral",
  correct: "blue",
};

export function ProductsTable({
  stats,
  sourcing,
  suppliers,
}: {
  stats: ProductStats[];
  sourcing?: Record<string, ProductSourcing>;
  suppliers?: Supplier[];
}) {
  const [selected, setSelected] = useState<ProductStats | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const { run, pending } = useDeskAction();

  const requestPrice = async (product: ProductStats["product"], supplier: Supplier) => {
    const body = fillTemplate(templateByKey("price_availability")?.body ?? "", {
      product_name: product.title,
      variant: "—",
      quantity: 1,
      country: "FR",
      product_reference: product.handle || product.id,
    });
    const link = waLink(supplier.whatsapp, body);
    const ok = await run({
      type: "record_message",
      supplierId: supplier.id,
      templateKey: "price_availability",
      body,
      status: link ? "sent_manual" : "prepared",
    });
    if (ok) {
      if (link) {
        window.open(link, "_blank", "noopener");
        toast(`Demande de prix envoyée à ${supplier.name}`, "success");
      } else {
        toast(`Message préparé pour ${supplier.name} (pas de WhatsApp) — voir Messages`, "info");
      }
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[12px]">
          <thead>
            <tr className="border-b border-ink/5 text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-soft">
              <th className="py-2.5 pr-3 font-semibold">Produit</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Vues</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Ajouts</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Vue→Panier</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Checkouts</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Achats</th>
              <th className="py-2.5 pr-3 text-right font-semibold">CA</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Marge est.</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Stock</th>
              <th className="py-2.5 pr-3 font-semibold">Scores</th>
              <th className="py-2.5 font-semibold">Catégorie</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.product.id}
                onClick={() => setSelected(s)}
                className="cursor-pointer border-b border-ink/[0.04] transition-colors last:border-0 hover:bg-white/70"
              >
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    {s.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.product.imageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-ink/5"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white to-ink/10 text-[10px] font-bold text-ink-soft shadow-sm ring-1 ring-ink/5">
                        {s.product.title
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")}
                      </span>
                    )}
                    <div>
                      <div className="font-semibold leading-tight">{s.product.title}</div>
                      <div className="num text-[10.5px] text-ink-soft">{formatEUR(s.product.priceMin)}</div>
                    </div>
                  </div>
                </td>
                <td className="num py-3 pr-3 text-right">{formatNumber(s.views)}</td>
                <td className="num py-3 pr-3 text-right">{s.addToCarts}</td>
                <td className="num py-3 pr-3 text-right">{formatPct(s.viewToCartRate)}</td>
                <td className="num py-3 pr-3 text-right">{s.checkouts}</td>
                <td className="num py-3 pr-3 text-right font-semibold">{s.purchases}</td>
                <td className="num py-3 pr-3 text-right font-semibold">{formatEUR(s.revenue)}</td>
                <td className="num py-3 pr-3 text-right text-ink-soft">{formatEUR(s.estimatedMargin)}</td>
                <td className="num py-3 pr-3 text-right text-ink-soft">{s.product.stock ?? "—"}</td>
                <td className="py-3 pr-3">
                  <ScoreCell label="Conv." value={s.conversionScore} />
                  <ScoreCell label="Frict." value={s.frictionScore} inverted />
                  <ScoreCell label="Data" value={s.dataReliability} />
                </td>
                <td className="py-3">
                  <Badge tone={CATEGORY_TONES[s.category]}>{PRODUCT_CATEGORY_LABELS[s.category]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fiche produit */}
      <Drawer
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.product.title ?? ""}
        subtitle={
          selected
            ? `${formatEUR(selected.product.priceMin)} · ${selected.product.productType ?? "Produit"} · Stock : ${selected.product.stock ?? "—"}`
            : undefined
        }
        badge={
          selected && <Badge tone={CATEGORY_TONES[selected.category]}>{PRODUCT_CATEGORY_LABELS[selected.category]}</Badge>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <MiniStat label="CA" value={formatEUR(selected.revenue)} />
              <MiniStat label="Marge estimée" value={formatEUR(selected.estimatedMargin)} />
              <MiniStat label="Taux d'achat" value={formatPct(selected.purchaseRate)} />
            </div>

            <div className="inset-panel p-3">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Funnel du produit
              </div>
              <MiniFunnel stats={selected} />
            </div>

            <div className="space-y-2.5">
              <ScoreLine label="Score de conversion" value={selected.conversionScore} />
              <ScoreLine label="Score de friction" value={selected.frictionScore} inverted />
              <ScoreLine label="Fiabilité data" value={selected.dataReliability} />
            </div>

            {selected.insight && (
              <div className="flex gap-2.5 rounded-xl bg-warn-soft/60 p-3">
                <Lightbulb size={15} className="mt-0.5 shrink-0 text-warn" />
                <p className="text-[12px] leading-relaxed">{selected.insight}</p>
              </div>
            )}

            <div className="flex gap-2.5 rounded-xl bg-brand-soft/60 p-3">
              <Wrench size={15} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <div className="text-[12px] font-semibold">Action recommandée</div>
                <p className="text-[12px] leading-relaxed text-ink-soft">{selected.recommendedAction}</p>
              </div>
            </div>

            {/* Sourcing : historique produit ↔ fournisseurs */}
            {sourcing?.[selected.product.id] && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  <Factory size={12} /> Sourcing
                  <Badge tone={SOURCING_TONES[sourcing[selected.product.id].status]} className="ml-1">
                    {SOURCING_STATUS_LABELS[sourcing[selected.product.id].status]}
                  </Badge>
                </div>
                {(() => {
                  const src = sourcing[selected.product.id];
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <MiniStat
                          label="Fournisseur actuel"
                          value={src.currentSupplierName ?? "Aucun"}
                        />
                        <MiniStat
                          label="Coût actuel"
                          value={src.currentCost != null ? formatEUR(src.currentCost) : "—"}
                        />
                        <MiniStat
                          label="Marge estimée"
                          value={src.marginPct != null ? `${src.marginPct} %` : "—"}
                        />
                        <MiniStat
                          label="Meilleur prix connu"
                          value={src.bestHistoricalPrice != null ? formatEUR(src.bestHistoricalPrice) : "—"}
                        />
                        <MiniStat
                          label="Dernier prix reçu"
                          value={
                            src.lastQuotePrice != null
                              ? `${formatEUR(src.lastQuotePrice)}${src.lastQuoteAt ? ` (${formatDate(src.lastQuoteAt)})` : ""}`
                              : "—"
                          }
                        />
                        <MiniStat
                          label="Délai moyen"
                          value={src.avgLeadTimeDays != null ? `${src.avgLeadTimeDays} j` : "—"}
                        />
                      </div>

                      {src.comparison.recommendation && (
                        <p className="flex items-start gap-2 rounded-xl bg-positive-soft/70 px-3 py-2 text-[11.5px] font-medium leading-relaxed text-positive">
                          <Award size={13} className="mt-0.5 shrink-0" /> {src.comparison.recommendation}
                        </p>
                      )}

                      <button
                        onClick={() => setShowCompare((s) => !s)}
                        disabled={src.comparison.rows.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-50"
                      >
                        {showCompare ? "Masquer la comparaison" : `Comparer fournisseurs (${src.comparison.rows.length})`}
                      </button>

                      {showCompare && src.comparison.rows.length > 0 && (
                        <div className="fade-up space-y-1.5">
                          {src.comparison.rows.map((row) => {
                            const supplier = suppliers?.find((s) => s.id === row.supplier.id);
                            return (
                              <div key={row.offer.id} className="inset-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11.5px]">
                                <span className="font-semibold">{row.supplier.name}</span>
                                {row.flags.recommended && <Badge tone="green">Recommandé</Badge>}
                                {row.flags.avoid && <Badge tone="red">À éviter</Badge>}
                                <span className="num text-ink-soft">
                                  {formatEUR(row.totalPrice)} · {row.leadTimeDays ?? "—"} j · fiab. {row.reliability}
                                  {row.estimatedMarginPct != null && ` · marge ${row.estimatedMarginPct} %`}
                                </span>
                                {supplier && (
                                  <button
                                    onClick={() => requestPrice(selected.product, supplier)}
                                    disabled={pending}
                                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2 py-1 text-[10.5px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
                                  >
                                    <ExternalLink size={10} /> Demander un nouveau prix
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {src.comparison.rows.length === 0 && (
                        <p className="text-[11.5px] text-ink-soft">
                          Aucun fournisseur connu pour ce produit. Ajoutez une offre depuis la page Fournisseurs.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

function ScoreCell({ label, value, inverted }: { label: string; value: number; inverted?: boolean }) {
  const good = inverted ? value < 40 : value >= 60;
  const mid = inverted ? value < 70 : value >= 35;
  const color = good ? "var(--color-positive)" : mid ? "var(--color-warn)" : "var(--color-critical)";
  return (
    <div className="mb-1 flex items-center gap-1.5 last:mb-0">
      <span className="w-8 text-[9.5px] uppercase tracking-wide text-ink-soft">{label}</span>
      <ProgressBar value={value} color={color} height={4} className="w-14" />
      <span className="num w-6 text-right text-[10px] font-semibold">{value}</span>
    </div>
  );
}

function ScoreLine({ label, value, inverted }: { label: string; value: number; inverted?: boolean }) {
  const good = inverted ? value < 40 : value >= 60;
  const mid = inverted ? value < 70 : value >= 35;
  const color = good ? "var(--color-positive)" : mid ? "var(--color-warn)" : "var(--color-critical)";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11.5px] text-ink-soft">{label}</span>
        <span className="num text-[12px] font-semibold">{value}/100</span>
      </div>
      <ProgressBar value={value} color={color} height={6} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inset-panel p-2.5 text-center">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="num mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}

export function MiniFunnel({ stats }: { stats: ProductStats }) {
  const steps = [
    { label: "Vues", value: stats.views },
    { label: "Paniers", value: stats.addToCarts },
    { label: "Checkouts", value: stats.checkouts },
    { label: "Achats", value: stats.purchases },
  ];
  const base = steps[0].value || 1;
  return (
    <div className="flex items-end gap-1.5">
      {steps.map((s) => (
        <div key={s.label} className="flex-1">
          <div className="flex h-12 items-end overflow-hidden rounded-md bg-ink/5">
            <div
              className="grow-bar w-full rounded-md bg-brand/70"
              style={{ height: `${Math.max(s.value > 0 ? 8 : 2, (s.value / base) * 100)}%` }}
            />
          </div>
          <div className="mt-0.5 text-center text-[9px] text-ink-soft">
            {s.label} <span className="num font-semibold text-ink">{s.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
