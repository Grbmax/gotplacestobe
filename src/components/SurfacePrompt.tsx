"use client";

type Props = {
  room: string;
  surface: string;
  reason: string;
  covered?: number;
  total?: number;
};

export function SurfacePrompt({ room, surface, reason, covered, total }: Props) {
  const surfaceLabel = surface.replace(/_/g, " ");
  const showBar = typeof covered === "number" && typeof total === "number" && total > 0;
  const pct = showBar ? Math.min(100, Math.round((covered! / total!) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Point at</p>
      <p className="mt-1 text-sm font-medium">
        the {room} {surfaceLabel}
      </p>
      <p className="mt-1 text-xs text-white/60">{reason}</p>
      {showBar && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-white/40">
            {covered} of {total} known surfaces covered
          </p>
        </div>
      )}
    </div>
  );
}
