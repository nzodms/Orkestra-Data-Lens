import { ArrowUpRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import type { PriorityAction } from "@/lib/types";
import { formatEUR } from "@/lib/utils";

const IMPACT: Record<PriorityAction["impact"], { label: string; tone: BadgeTone }> = {
  high: { label: "Impact élevé", tone: "green" },
  medium: { label: "Impact moyen", tone: "blue" },
  low: { label: "Impact faible", tone: "neutral" },
};

const DIFFICULTY: Record<PriorityAction["difficulty"], string> = {
  easy: "Facile",
  medium: "Modéré",
  hard: "Difficile",
};

const TYPE_TONES: Record<PriorityAction["type"], BadgeTone> = {
  tracking: "violet",
  produit: "blue",
  source: "orange",
  checkout: "red",
  conversion: "green",
};

export function PriorityActions({ actions }: { actions: PriorityAction[] }) {
  return (
    <Card>
      <CardTitle sub="Chaque action est justifiée par les données de la période — aucune recommandation générique.">
        Actions prioritaires
      </CardTitle>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div
            key={action.id}
            className="fade-up rounded-xl border border-gray-200/70 bg-gray-50/60 p-3.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-white">
                {i + 1}
              </span>
              <h3 className="flex-1 text-[13px] font-semibold leading-snug">{action.title}</h3>
              <ArrowUpRight size={14} className="text-ink-soft" />
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{action.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={IMPACT[action.impact].tone}>{IMPACT[action.impact].label}</Badge>
              <Badge tone="neutral">{DIFFICULTY[action.difficulty]}</Badge>
              <Badge tone={TYPE_TONES[action.type]} className="capitalize">
                {action.type}
              </Badge>
              {action.estimatedRevenue != null && (
                <Badge tone="green">≈ {formatEUR(action.estimatedRevenue)} récupérables</Badge>
              )}
            </div>
            <p className="mt-2 border-l-2 border-brand/30 pl-2.5 text-[11.5px] italic leading-relaxed text-ink-soft">
              {action.justification}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
