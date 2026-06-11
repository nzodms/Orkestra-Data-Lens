import { Badge } from "@/components/ui/Badge";
import { formatNumber, formatPct } from "@/lib/utils";

export type FunnelRow = {
  label: string;
  value: number;
  note?: string;
  noteTone?: "orange" | "green" | "blue";
};

/**
 * Funnel vertical à barres : valeur, barre proportionnelle à la première
 * étape, taux de passage vs étape précédente.
 */
export function FunnelSteps({ rows, color = "var(--color-brand)" }: { rows: FunnelRow[]; color?: string }) {
  const base = rows[0]?.value || 1;
  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const prev = i > 0 ? rows[i - 1].value : null;
        const rate = prev != null && prev > 0 ? (row.value / prev) * 100 : null;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium">{row.label}</span>
                {row.note && <Badge tone={row.noteTone ?? "orange"}>{row.note}</Badge>}
              </div>
              <div className="flex items-baseline gap-2">
                {rate != null && (
                  <span className="num text-[10.5px] text-ink-soft">{formatPct(rate)}</span>
                )}
                <span className="num text-[14px] font-semibold">{formatNumber(row.value)}</span>
              </div>
            </div>
            <div className="h-[10px] overflow-hidden rounded-full bg-gray-100">
              <div
                className="grow-bar h-full rounded-full"
                style={{
                  width: `${Math.max(row.value > 0 ? 1.5 : 0, (row.value / base) * 100)}%`,
                  background: color,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
