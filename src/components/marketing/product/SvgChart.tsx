export function SvgChart({ values, label, className }: { values: readonly number[]; label: string; className?: string }) {
  const width = 360;
  const height = 132;
  const pad = 8;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width - pad} ${height - pad} L${pad} ${height - pad} Z`;
  const gradientId = `rive-chart-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" stopOpacity=".24" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((line) => (
        <line key={line} x1={pad} x2={width - pad} y1={height * line} y2={height * line} stroke="#dbe5f0" strokeDasharray="4 5" />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={index === points.length - 1 ? 4 : 2.3} fill={index === points.length - 1 ? "#2563eb" : "#93c5fd"} />
      ))}
    </svg>
  );
}
