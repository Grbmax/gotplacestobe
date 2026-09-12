"use client";

type Props = {
  guided: number[];
  naive: number[];
  showNaive: boolean;
};

function pathFor(series: number[], max: number, w: number, h: number, pad: number) {
  if (!series.length) return "";
  return series
    .map((v, i) => {
      const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function OptimizeChart({ guided, naive, showNaive }: Props) {
  const w = 320;
  const h = 160;
  const pad = 10;
  const max = Math.max(1, ...guided, ...naive);
  const photos = Math.max(guided.length, naive.length);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
        {showNaive && <path d={pathFor(naive, max, w, h, pad)} fill="none" stroke="#71717a" strokeWidth="2.5" />}
        <path d={pathFor(guided, max, w, h, pad)} fill="none" stroke="#34d399" strokeWidth="3" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>1 photo</span>
        <span>{photos} photos</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Guided
        </span>
        {showNaive && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-500" /> Naive (capture order)
          </span>
        )}
      </div>
    </div>
  );
}
