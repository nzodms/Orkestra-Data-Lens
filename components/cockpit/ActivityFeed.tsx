"use client";

import { useMemo, useState } from "react";
import { Activity, Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ACTIVITY_ENTITY_LABELS, type ActivityEntityType, type ActivityLog } from "@/lib/activity";
import { cn, formatDateTime } from "@/lib/utils";

const FILTERS: { value: ActivityEntityType | "all"; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "order", label: "Commandes" },
  { value: "supplier", label: "Fournisseurs" },
  { value: "product", label: "Produits" },
  { value: "tracking", label: "Tracking" },
  { value: "anomaly", label: "Anomalies / alertes" },
  { value: "system", label: "Système" },
];

export function ActivityFeed({ activities, mode }: { activities: ActivityLog[]; mode: "demo" | "live" }) {
  const [filter, setFilter] = useState<ActivityEntityType | "all">("all");
  const [limit, setLimit] = useState(40);

  const filtered = useMemo(
    () => activities.filter((a) => filter === "all" || a.entityType === filter),
    [activities, filter]
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all",
                filter === f.value
                  ? "border-ink bg-ink text-white shadow-md"
                  : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white"
              )}
            >
              {f.label}
              <span className="num ml-1 opacity-60">
                {f.value === "all" ? activities.length : activities.filter((a) => a.entityType === f.value).length}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <a
            href="/api/export?type=activity&format=csv"
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[11.5px] font-semibold shadow-sm hover:bg-white"
          >
            <Download size={12} /> CSV
          </a>
          <a
            href="/api/export?type=activity&format=json"
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[11.5px] font-semibold shadow-sm hover:bg-white"
          >
            <Download size={12} /> JSON
          </a>
        </div>
      </div>

      {mode === "demo" && (
        <p className="card px-3.5 py-2 text-[11.5px] font-medium text-warn">
          Mode démo : journal d&apos;exemple — les nouvelles actions s&apos;y ajoutent mais ne sont pas persistées.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <Activity size={20} className="text-ink-soft" />
          <p className="text-[13px] font-medium">Aucune activité dans cette catégorie</p>
          <p className="text-[12px] text-ink-soft">Chaque action (statut, fournisseur, message, tracking…) apparaîtra ici.</p>
        </div>
      ) : (
        <div className="card p-4 md:p-5">
          <ol className="relative ml-1 space-y-3 border-l border-ink/8 pl-5">
            {filtered.slice(0, limit).map((a) => (
              <li key={a.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                    a.actorType === "system" ? "bg-ink/30" : "bg-brand/70"
                  )}
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Badge tone={a.actorType === "system" ? "neutral" : "blue"}>
                    {ACTIVITY_ENTITY_LABELS[a.entityType]}
                  </Badge>
                  <span className="text-[12.5px] font-semibold leading-snug">{a.title}</span>
                  <span className="num ml-auto whitespace-nowrap text-[10.5px] text-ink-soft">
                    {a.actorType === "system" ? "Système" : "Vous"} · {formatDateTime(a.createdAt)}
                  </span>
                </div>
                {a.description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{a.description}</p>}
              </li>
            ))}
          </ol>
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 40)}
              className="mt-3 w-full rounded-xl border border-ink/10 bg-white/60 py-2 text-center text-[12px] font-semibold text-brand hover:bg-white"
            >
              Afficher plus ({filtered.length - limit} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
