import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/events";

export type BadgeTone = "neutral" | "blue" | "green" | "orange" | "red" | "violet";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600 border-gray-200/70",
  blue: "bg-brand-soft text-brand-strong border-brand/15",
  green: "bg-positive-soft text-positive border-positive/15",
  orange: "bg-warn-soft text-warn border-warn/15",
  red: "bg-critical-soft text-critical border-critical/15",
  violet: "bg-ai-soft text-ai border-ai/15",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<EventStatus, BadgeTone> = {
  observed: "neutral",
  confirmed: "green",
  reconciled: "blue",
  incomplete: "orange",
  out_of_period: "orange",
  suspect: "red",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
