"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClockOff, ArrowRight, BellRing, Check, RotateCcw } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import type { AlertStatus, OperationalAlert } from "@/lib/activity";
import { ALERT_CATEGORY_LABELS } from "@/lib/activity";
import { cn } from "@/lib/utils";

const SEVERITY_TONES: Record<OperationalAlert["severity"], BadgeTone> = {
  low: "neutral",
  medium: "orange",
  high: "red",
  critical: "red",
};

const SEVERITY_LABELS: Record<OperationalAlert["severity"], string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export function AlertsPanel({ alerts }: { alerts: OperationalAlert[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<AlertStatus>("active");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      active: alerts.filter((a) => a.status === "active").length,
      snoozed: alerts.filter((a) => a.status === "snoozed").length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
    }),
    [alerts]
  );
  const visible = alerts.filter((a) => a.status === tab);

  const update = async (alert: OperationalAlert, status: AlertStatus) => {
    setPendingId(alert.id);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, alert }),
      });
      if (res.ok) {
        toast(
          status === "resolved"
            ? "Alerte résolue"
            : status === "snoozed"
              ? "Alerte snoozée pour 24 h"
              : "Alerte réactivée",
          "success"
        );
        router.refresh();
      } else {
        toast("Mise à jour impossible", "error");
      }
    } catch {
      toast("Serveur injoignable", "error");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="card p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn-soft text-warn">
          <BellRing size={15} />
        </span>
        <h2 className="text-[14.5px] font-semibold tracking-tight">Alertes opérationnelles</h2>
        <div className="ml-auto flex gap-1">
          {(
            [
              { value: "active", label: `Actives (${counts.active})` },
              { value: "snoozed", label: `Snoozées (${counts.snoozed})` },
              { value: "resolved", label: `Résolues (${counts.resolved})` },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
                tab === t.value
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-positive-soft/60 px-3 py-3 text-center text-[12.5px] font-medium text-positive">
          {tab === "active" ? "Aucune alerte active — tout est sous contrôle." : "Rien ici."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((alert) => (
            <div key={alert.id} className="inset-panel p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={SEVERITY_TONES[alert.severity]}>{SEVERITY_LABELS[alert.severity]}</Badge>
                <Badge tone="neutral">{ALERT_CATEGORY_LABELS[alert.category]}</Badge>
                <span className="text-[12.5px] font-semibold leading-snug">{alert.title}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{alert.description}</p>
              {alert.recommendedAction && (
                <p className="mt-1 text-[11.5px] leading-relaxed">
                  <span className="font-semibold">Action recommandée : </span>
                  <span className="text-ink-soft">{alert.recommendedAction}</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {alert.href && (
                  <Link
                    href={alert.href}
                    className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                  >
                    Agir <ArrowRight size={11} />
                  </Link>
                )}
                {alert.status !== "resolved" && (
                  <button
                    onClick={() => update(alert, "resolved")}
                    disabled={pendingId === alert.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-positive/25 bg-positive-soft px-2.5 py-1.5 text-[11px] font-semibold text-positive hover:bg-positive hover:text-white disabled:opacity-50"
                  >
                    <Check size={11} /> Résoudre
                  </button>
                )}
                {alert.status === "active" && (
                  <button
                    onClick={() => update(alert, "snoozed")}
                    disabled={pendingId === alert.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
                  >
                    <AlarmClockOff size={11} /> Snoozer 24 h
                  </button>
                )}
                {alert.status !== "active" && (
                  <button
                    onClick={() => update(alert, "active")}
                    disabled={pendingId === alert.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
                  >
                    <RotateCcw size={11} /> Réactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
