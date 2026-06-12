"use client";

import { useState } from "react";
import { Clock3, Lightbulb, TrendingDown, Wrench } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import type { AbandonmentStats } from "@/lib/analytics";
import { cn, formatDuration, formatEUR, formatPct } from "@/lib/utils";

export function AbandonmentTabs({ stats }: { stats: AbandonmentStats[] }) {
  const [active, setActive] = useState(stats[0]?.key ?? "product");
  const current = stats.find((s) => s.key === active) ?? stats[0];
  const totalLoss = stats.reduce((a, s) => a + s.estimatedLoss, 0);
  const peakHour = current.topHours[0]?.hour;
  const heatHours = current.hourHistogram.slice(8); // 8h → 23h
  const heatMax = Math.max(...heatHours, 1);

  return (
    <div className="space-y-4">
      {/* Perte totale très visible */}
      <div className="card card-hover relative overflow-hidden p-4 md:p-5">
        <span className="absolute inset-y-0 left-0 w-1 rounded-l-[1.15rem] bg-gradient-to-b from-critical to-warn" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-2">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              Perte totale estimée sur la période
            </div>
            <div className="num text-[28px] font-semibold tracking-tight text-critical">
              {formatEUR(Math.round(totalLoss))}
            </div>
          </div>
          <div className="hidden h-10 w-px bg-ink/10 sm:block" />
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {stats.map((s) => (
              <div key={s.key} className="text-[11.5px]">
                <span className="text-ink-soft">{s.label} : </span>
                <span className="num font-semibold text-ink">{formatEUR(Math.round(s.estimatedLoss))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cartes par type d'abandon */}
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
                s.key === active && "shadow-[0_0_0_2px_rgba(42,91,215,0.22),inset_0_1px_0_rgba(255,255,255,0.85)]"
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
              "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200",
              active === s.key
                ? "border-ink bg-ink text-white shadow-md"
                : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white hover:text-ink"
            )}
          >
            {s.label}
          </button>
        ))}
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
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
              <Clock3 size={13} className="text-brand" />
              Heures d&apos;abandon (8h → 23h)
            </div>
            <div className="flex gap-1">
              {heatHours.map((count, i) => {
                const intensity = count / heatMax;
                const hour = i + 8;
                return (
                  <div key={hour} className="group relative flex-1">
                    <div
                      className={cn(
                        "h-9 rounded-md transition-transform duration-150 group-hover:scale-y-110",
                        hour === peakHour && count > 0 && "ring-2 ring-warn/60"
                      )}
                      style={{
                        background:
                          count === 0
                            ? "rgba(18,25,43,0.05)"
                            : `rgba(194,88,10,${0.16 + intensity * 0.74})`,
                      }}
                    />
                    <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {hour}h · {count}
                    </div>
                  </div>
                );
              })}
            </div>
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
