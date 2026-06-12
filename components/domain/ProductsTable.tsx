"use client";

import { useState } from "react";
import { Lightbulb, Wrench } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PRODUCT_CATEGORY_LABELS, type ProductCategory, type ProductStats } from "@/lib/analytics";
import { formatEUR, formatNumber, formatPct } from "@/lib/utils";

export const CATEGORY_TONES: Record<ProductCategory, BadgeTone> = {
  scaler: "green",
  ameliorer: "orange",
  bloque_checkout: "red",
  suspect: "violet",
  couper: "neutral",
  correct: "blue",
};

export function ProductsTable({ stats }: { stats: ProductStats[] }) {
  const [selected, setSelected] = useState<ProductStats | null>(null);

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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white to-ink/10 text-[10px] font-bold text-ink-soft shadow-sm ring-1 ring-ink/5">
                      {s.product.title
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </span>
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
