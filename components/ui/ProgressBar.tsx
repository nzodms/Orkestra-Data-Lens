import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  color = "var(--color-brand)",
  className,
  height = 6,
}: {
  value: number; // 0-100
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-gray-100", className)} style={{ height }}>
      <div
        className="grow-bar h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}
