import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "warn" | "critical" | "brand";
  icon?: LucideIcon;
  className?: string;
}) {
  const valueColor = {
    default: "text-ink",
    positive: "text-positive",
    warn: "text-warn",
    critical: "text-critical",
    brand: "text-brand-strong",
  }[tone];

  const iconStyle = {
    default: "bg-ink/5 text-ink-soft",
    positive: "bg-positive-soft text-positive",
    warn: "bg-warn-soft text-warn",
    critical: "bg-critical-soft text-critical",
    brand: "bg-brand-soft text-brand-strong",
  }[tone];

  return (
    <div className={cn("card card-hover flex flex-col justify-between p-3.5 md:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
        {Icon && (
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", iconStyle)}>
            <Icon size={13} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className={cn("num mt-1.5 text-[24px] font-semibold leading-tight tracking-tight md:text-[26px]", valueColor)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-ink-soft">{sub}</div>}
    </div>
  );
}
