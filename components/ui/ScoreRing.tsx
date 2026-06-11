export function ScoreRing({
  value,
  size = 72,
  strokeWidth = 7,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color = value >= 85 ? "var(--color-positive)" : value >= 65 ? "var(--color-warn)" : "var(--color-critical)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,24,31,0.07)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.21,0.61,0.35,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num font-semibold leading-none" style={{ fontSize: size * 0.26 }}>
          {Math.round(value)}
        </span>
        {label && <span className="mt-0.5 text-[9px] font-medium text-ink-soft">{label}</span>}
      </div>
    </div>
  );
}
