"use client";

import { roomSurfaceLabel } from "@/lib/labels";

type Props = {
  room: string;
  surface: string;
  reason: string;
  hint?: string;
};

export function SurfacePrompt({ room, surface, reason, hint }: Props) {
  return (
    <div className="rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Point at</p>
      <p className="mt-1 text-lg font-medium leading-snug">{roomSurfaceLabel(room, surface)}</p>
      <p className="mt-1 text-xs text-white/70">{reason}</p>
      {hint && <p className="mt-2 text-xs text-emerald-200">{hint}</p>}
    </div>
  );
}
