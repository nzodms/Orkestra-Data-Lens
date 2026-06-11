import { AlertCircle, AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/types";

const TONE_STYLES = {
  info: { icon: Info, ring: "border-brand/15 bg-brand-soft/40", iconColor: "text-brand" },
  success: { icon: CheckCircle2, ring: "border-positive/15 bg-positive-soft/50", iconColor: "text-positive" },
  warning: { icon: AlertTriangle, ring: "border-warn/15 bg-warn-soft/50", iconColor: "text-warn" },
  critical: { icon: AlertCircle, ring: "border-critical/15 bg-critical-soft/50", iconColor: "text-critical" },
  ai: { icon: Sparkles, ring: "border-ai/15 bg-ai-soft/50", iconColor: "text-ai" },
} as const;

export function InsightCard({ insight, className }: { insight: Insight; className?: string }) {
  const style = TONE_STYLES[insight.tone];
  const Icon = style.icon;
  return (
    <div className={cn("card flex gap-3 border p-4", style.ring, className)}>
      <Icon size={17} className={cn("mt-0.5 shrink-0", style.iconColor)} strokeWidth={2.1} />
      <div>
        <div className="text-[13px] font-semibold leading-snug">{insight.title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{insight.body}</p>
      </div>
    </div>
  );
}
