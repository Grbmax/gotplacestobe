"use client";

type Props = {
  points: { at: string; ratio: number }[];
};

export function Timeline({ points }: Props) {
  if (!points.length) {
    return <p className="text-sm text-ink/45">No timeline yet.</p>;
  }
  const max = Math.max(0.05, ...points.map((p) => p.ratio));
  const w = 280;
  const h = 72;
  const pad = 8;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - (p.ratio / max) * (h - pad * 2);
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-3 text-ink">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full">
        <path d={path} fill="none" stroke="#d6ff4a" strokeWidth="2.5" />
        {coords.map((c) => (
          <circle key={c.at} cx={c.x} cy={c.y} r="3.5" fill="#1c2618" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink/45">
        <span>{new Date(points[0]!.at).toLocaleDateString()}</span>
        <span>{(points[points.length - 1]!.ratio * 100).toFixed(1)}%</span>
        <span>{new Date(points[points.length - 1]!.at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
