"use client";

import { DetectorBadge } from "@/components/DetectorBadge";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { citationLines } from "@/lib/articleVi";
import { escalationSentence, roomSurfaceLabel, thisFrameFlaggedCopy } from "@/lib/labels";
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
          <p className="truncate text-sm font-medium">{roomSurfaceLabel(scan.room, scan.surface, " / ")}</p>
          <DetectorBadge detector={scan.detector} sample={scan.isSample} degraded={scan.degraded} />
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{scan.finding}</p>
        {scan.imagineUrl ? (
          <figure className="mt-2 overflow-hidden rounded-xl border border-violet-400/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scan.imagineUrl} alt="" className="aspect-video w-full object-cover opacity-95" />
            <figcaption className="bg-violet-950/40 px-2 py-1 text-[9px] uppercase tracking-wider text-violet-200/90">
              Grok Imagine · educational — not this unit
            </figcaption>
          </figure>
        ) : null}
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
          <p className="mt-1 text-[11px] leading-snug text-rose-300">{escalationSentence(scan.escalations[0])}</p>
        )}
        <p className="mt-2 text-xs text-zinc-400">
          {thisFrameFlaggedCopy(scan.totalAffectedRatio)} · {new Date(scan.capturedAt).toLocaleDateString()}
        </p>
        {scan.scannedByName && <p className="mt-0.5 text-[11px] text-zinc-500">by {scan.scannedByName}</p>}
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
