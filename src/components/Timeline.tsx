"use client";

import { formatTimeSpan } from "@/lib/time";

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

export function Timeline({ points, civic, direction }: Props) {
  if (!points.length) {
    return <p className="text-sm text-slate-500">No timeline yet.</p>;
  }
  const max = Math.max(0.05, ...points.map((p) => p.ratio), ...(civic ?? []).map((p) => p.ratio));
  const w = 280;
  const h = 88;
  const pad = 10;
  const micro = pathFrom(points, w, h, pad, max);
  const macro = civic?.length ? pathFrom(civic, w, h, pad, max) : null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const span = points.length >= 2 ? formatTimeSpan(first.at, last.at) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Defect coverage</p>
        {direction === "worsening" ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">
            Worsening
          </span>
        ) : direction === "improving" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            Improving
          </span>
        ) : direction === "stable" ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            Stable
          </span>
        ) : direction === "insufficient_data" ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Need another scan
          </span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-24 w-full">
        {macro && <path d={macro.path} fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 3" />}
        <path d={micro.path} fill="none" stroke="#059669" strokeWidth="2.5" />
        {micro.coords.map((c) => (
          <g key={c.at}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#059669" />
            <text x={c.x} y={Math.max(10, c.y - 8)} textAnchor="middle" fill="#64748b" fontSize="8">
              {(c.ratio * 100).toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{(first.ratio * 100).toFixed(0)}% coverage</span>
        <span>{span ?? `${(last.ratio * 100).toFixed(0)}% coverage`}</span>
      </div>
      {macro ? (
        <p className="mt-1 text-[10px] text-sky-800/80">
          Blue dashed = neighborhood 311 volume (same months, scaled). Green = this property’s defect area.
        </p>
      ) : null}
    </div>
  );
}
