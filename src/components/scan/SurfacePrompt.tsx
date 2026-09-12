"use client";

type Props = {
  room: string;
  surface: string;
  reason: string;
};

export function SurfacePrompt({ room, surface, reason }: Props) {
  const surfaceLabel = surface.replace(/_/g, " ");
  return (
    <div className="rounded-2xl bg-ink/70 px-4 py-3 text-paper backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.2em] text-leaf">Point at</p>
      <p className="mt-1 text-sm font-medium">
        the {room} {surfaceLabel}
      </p>
      <p className="mt-1 text-xs text-paper/60">{reason}</p>
    </div>
  );
}
