"use client";

type Props = {
  guided: number[];
  naive: number[];
  showNaive: boolean;
};

function pathFor(series: number[], max: number, w: number, h: number, padL: number, padR: number, padT: number, padB: number) {
  if (!series.length) return "";
  return series
    .map((v, i) => {
      const x = padL + (i / Math.max(1, series.length - 1)) * (w - padL - padR);
      const y = h - padB - (v / max) * (h - padT - padB);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function OptimizeChart({ guided, naive, showNaive }: Props) {
  const w = 320;
  const h = 180;
  const padL = 36;
  const padR = 28;
  const padT = 16;
  const padB = 24;
  const max = Math.max(1, ...guided, ...naive);
  const photos = Math.max(guided.length, naive.length);
  const guidedEnd = guided[guided.length - 1] ?? 0;
  const naiveEnd = naive[naive.length - 1] ?? 0;
  const yTop = padT;
  const yBot = h - padB;
  const xEnd = w - padR;
  const guidedY = yBot - (guidedEnd / max) * (yBot - yTop);
  const naiveY = yBot - (naiveEnd / max) * (yBot - yTop);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" role="img" aria-label="Defects found versus photos taken">
        {/* Gridline at total */}
        <line x1={padL} y1={yTop} x2={xEnd} y2={yTop} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={padL} y1={yBot} x2={xEnd} y2={yBot} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padL} y1={yTop} x2={padL} y2={yBot} stroke="#e2e8f0" strokeWidth="1" />

        {/* Y ticks */}
        <text x={padL - 6} y={yBot + 3} textAnchor="end" fill="#64748b" fontSize="9">
          0
        </text>
        <text x={padL - 6} y={yTop + 3} textAnchor="end" fill="#64748b" fontSize="9">
          {max}
        </text>
        <text
          x={12}
          y={(yTop + yBot) / 2}
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          transform={`rotate(-90 12 ${(yTop + yBot) / 2})`}
        >
          Defects found
        </text>

        {showNaive && (
          <path d={pathFor(naive, max, w, h, padL, padR, padT, padB)} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        )}
        <path d={pathFor(guided, max, w, h, padL, padR, padT, padB)} fill="none" stroke="#059669" strokeWidth="3" />

        {/* Endpoint labels */}
        <text x={xEnd + 4} y={guidedY + 3} fill="#64748b" fontSize="9">
          {guidedEnd}
        </text>
        {showNaive && Math.abs(naiveY - guidedY) > 10 && (
          <text x={xEnd + 4} y={naiveY + 3} fill="#64748b" fontSize="9">
            {naiveEnd}
          </text>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>1 photo</span>
        <span>{photos} photos</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" /> Guided
        </span>
        {showNaive && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> Naive (low-risk first)
          </span>
        )}
      </div>
    </div>
  );
}
