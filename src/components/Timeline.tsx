"use client";

type Props = {
  points: { at: string; ratio: number }[];
  civic?: { at: string; ratio: number; count: number }[];
  direction?: "worsening" | "improving" | "stable" | "insufficient_data";
};

function pathFrom(
  pts: { at: string; ratio: number }[],
  w: number,
  h: number,
  pad: number,
  max: number,
) {
  const coords = pts.map((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const y = h - pad - (p.ratio / max) * (h - pad * 2);
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  return { coords, path };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Timeline({ points, civic, direction }: Props) {
  if (!points.length) {
    return <p className="text-sm text-zinc-500">No timeline yet.</p>;
  }
  const max = Math.max(0.05, ...points.map((p) => p.ratio), ...(civic ?? []).map((p) => p.ratio));
  const w = 280;
  const h = 88;
  const pad = 10;
  const micro = pathFrom(points, w, h, pad, max);
  const macro = civic?.length ? pathFrom(civic, w, h, pad, max) : null;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-white">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Defect coverage</p>
        {direction === "worsening" ? (
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-300">
            Worsening
          </span>
        ) : direction === "improving" ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
            Improving
          </span>
        ) : direction === "stable" ? (
          <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
            Stable
          </span>
        ) : direction === "insufficient_data" ? (
          <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Need another scan
          </span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-24 w-full">
        {macro && <path d={macro.path} fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" />}
        <path d={micro.path} fill="none" stroke="#34d399" strokeWidth="2.5" />
        {micro.coords.map((c) => (
          <g key={c.at}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#34d399" />
            <text x={c.x} y={Math.max(10, c.y - 8)} textAnchor="middle" fill="#a1a1aa" fontSize="8">
              {(c.ratio * 100).toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>
          {shortDate(first.at)}: {(first.ratio * 100).toFixed(0)}% coverage
        </span>
        <span>
          {shortDate(last.at)}: {(last.ratio * 100).toFixed(0)}% coverage
        </span>
      </div>
      {macro ? (
        <p className="mt-1 text-[10px] text-amber-200/80">
          Amber dashed = neighborhood 311 volume (same months, scaled). Green = this property’s defect area.
        </p>
      ) : null}
    </div>
  );
}
