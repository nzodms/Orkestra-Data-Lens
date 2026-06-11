export function Sparkline({
  values,
  width = 220,
  height = 48,
  color = "var(--color-brand)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => [i * stepX, height - 4 - ((v - min) / range) * (height - 8)] as const);
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3} fill={color} />
    </svg>
  );
}

export function MiniBars({
  values,
  height = 44,
  color = "var(--color-brand)",
  highlight,
}: {
  values: number[];
  height?: number;
  color?: string;
  highlight?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(6, (v / max) * 100)}%`,
            background: i === highlight ? color : "rgba(20,24,31,0.10)",
          }}
        />
      ))}
    </div>
  );
}
