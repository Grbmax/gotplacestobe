"use client";

import { DetectorBadge } from "@/components/DetectorBadge";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { citationLines } from "@/lib/articleVi";
import type { Scan } from "@/lib/types";

type Props = {
  scan: Scan;
  onSelect?: () => void;
  onDelete?: () => void;
};

export function ScanCard({ scan, onSelect, onDelete }: Props) {
  const cites = citationLines(scan.detections);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left text-white">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <PhotoEvidence scan={scan} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">
            {scan.room} / {scan.surface.replace(/_/g, " ")}
          </p>
          <DetectorBadge detector={scan.detector} sample={scan.isSample} />
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{scan.finding}</p>
        {cites.length ? (
          <ul className="mt-2 space-y-1">
            {cites.map((c) => (
              <li key={c} className="text-[11px] leading-snug text-amber-200/90">
                {c}
              </li>
            ))}
          </ul>
        ) : null}
        {scan.escalations?.[0] && (
          <p className="mt-1 text-[11px] text-rose-300">
            {scan.escalations[0].from} → {scan.escalations[0].to}
          </p>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-2 w-full rounded-full border border-zinc-700 py-1.5 text-xs text-zinc-400"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
