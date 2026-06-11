"use client";

import { useState } from "react";
import { Clock3, Lightbulb, TrendingDown, Wrench } from "lucide-react";
import { MiniBars } from "@/components/charts/Sparkline";
import { Card, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import type { AbandonmentStats } from "@/lib/analytics";
import { cn, formatDuration, formatEUR, formatPct } from "@/lib/utils";

export function AbandonmentTabs({ stats }: { stats: AbandonmentStats[] }) {
  const [active, setActive] = useState(stats[0]?.key ?? "product");
  const current = stats.find((s) => s.key === active) ?? stats[0];
  const totalLoss = stats.reduce((a, s) => a + s.estimatedLoss, 0);

  const hourHistogram = Array.from({ length: 24 }, (_, h) => {
    const found = current.topHours.find((t) => t.hour === h);
    return found?.count ?? 0;
  }).slice(8); // 8h → 23h
  const peakHour = current.topHours[0]?.hour;

  return (
    <div className="space-y-4">
      {/* Vue d'ensemble des pertes */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        {stats.map((s) => (
          <button key={s.key} onClick={() => setActive(s.key)} className="text-left">
            <Stat
              label={s.label}
              value={s.sessions}
              sub={`≈ ${formatEUR(Math.round(s.estimatedLoss))} de perte estimée`}
              tone={s.key === active ? "brand" : "default"}
              className={cn(
                "h-full transition-all",
                s.key === active && "border-brand/30 shadow-[0_0_0_2px_rgba(42,91,215,0.12)]"
              )}
            />
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1.5">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
              active === s.key
                ? "border-ink bg-ink text-white shadow-sm"
                : "border-gray-200/80 bg-white text-ink-soft hover:text-ink"
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11.5px] text-ink-soft">
          Perte totale estimée : <span className="num font-semibold text-critical">{formatEUR(Math.round(totalLoss))}</span>
        </span>
      </div>

      {/* Détail de la catégorie */}
      <div className="fade-up grid gap-4 lg:grid-cols-3" key={current.key}>
        <Card className="lg:col-span-2">
          <CardTitle sub={current.description}>{current.label}</CardTitle>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Metric label="Sessions concernées" value={String(current.sessions)} />
            <Metric label={current.rateLabel} value={formatPct(current.rate)} />
            <Metric label="Perte estimée" value={formatEUR(Math.round(current.estimatedLoss))} critical />
            <Metric label="Durée moyenne" value={formatDuration(current.avgDurationSeconds)} />
            {current.topDevice && <Metric label="Appareil principal" value={current.topDevice} />}
            {current.topSources[0] && (
              <Metric label="Source principale" value={`${current.topSources[0].label} (${current.topSources[0].count})`} />
            )}
            {current.extraMetrics.map((m) => (
              <Metric key={m.label} label={m.label} value={m.value} />
            ))}
          </div>

          {current.topProducts.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
                <TrendingDown size={13} className="text-warn" />
                Produits les plus concernés
              </div>
              <div className="flex flex-wrap gap-1.5">
                {current.topProducts.map((p) => (
                  <span
                    key={p.title}
                    className="rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-[11.5px] font-medium"
                  >
                    {p.title} <span className="num text-ink-soft">×{p.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
              <Clock3 size={13} className="text-brand" />
              Heures d&apos;abandon les plus fréquentes
            </div>
            <MiniBars values={hourHistogram} highlight={peakHour != null ? peakHour - 8 : undefined} color="var(--color-warn)" />
            <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
              <span>8h</span>
              {peakHour != null && <span className="font-semibold text-warn">Pic : {peakHour}h</span>}
              <span>23h</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
              <Lightbulb size={14} className="text-warn" />
              Causes probables
            </div>
            <ul className="space-y-1.5">
              {current.probableCauses.map((c, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
              <Wrench size={14} className="text-brand" />
              Recommandations
            </div>
            <ul className="space-y-1.5">
              {current.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, critical }: { label: string; value: string; critical?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className={cn("num text-[15px] font-semibold", critical && "text-critical")}>{value}</div>
    </div>
  );
}
