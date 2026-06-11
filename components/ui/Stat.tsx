import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "warn" | "critical" | "brand";
  className?: string;
}) {
  const valueColor = {
    default: "text-ink",
    positive: "text-positive",
    warn: "text-warn",
    critical: "text-critical",
    brand: "text-brand-strong",
  }[tone];

  return (
    <div className={cn("card flex flex-col justify-between p-3.5 md:p-4", className)}>
      <div className="text-[11.5px] font-medium text-ink-soft">{label}</div>
      <div className={cn("num mt-1 text-[22px] font-semibold leading-tight tracking-tight md:text-2xl", valueColor)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-ink-soft">{sub}</div>}
    </div>
  );
}
