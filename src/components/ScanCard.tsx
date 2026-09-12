"use client";

import { DetectorBadge } from "@/components/DetectorBadge";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { citationLines } from "@/lib/articleVi";
import { displayFinding } from "@/lib/finding";
import { escalationSentence, roomSurfaceLabel, thisFrameFlaggedCopy } from "@/lib/labels";
import { formatScanTime } from "@/lib/time";
import type { Scan } from "@/lib/types";

type Props = {
  scan: Scan;
  onSelect?: () => void;
  onDelete?: () => void;
};

export function ScanCard({ scan, onSelect, onDelete }: Props) {
  const cites = citationLines(scan.detections);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-left text-slate-900">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <PhotoEvidence scan={scan} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{roomSurfaceLabel(scan.room, scan.surface, " / ")}</p>
          <DetectorBadge detector={scan.detector} sample={scan.isSample} degraded={scan.degraded} />
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{displayFinding(scan)}</p>
        {scan.imagineUrl ? (
          <figure className="mt-2 overflow-hidden rounded-xl border border-sky-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scan.imagineUrl} alt="" className="aspect-video w-full object-cover opacity-95" />
            <figcaption className="bg-sky-50 px-2 py-1 text-[9px] uppercase tracking-wider text-sky-800">
              Grok Imagine · educational — not this unit
            </figcaption>
          </figure>
        ) : null}
        {cites.length ? (
          <ul className="mt-2 space-y-1">
            {cites.map((c) => (
              <li key={c} className="text-[11px] leading-snug text-amber-800">
                {c}
              </li>
            ))}
          </ul>
        ) : null}
        {scan.escalations?.[0] && (
          <p className="mt-1 text-[11px] leading-snug text-rose-700">{escalationSentence(scan.escalations[0])}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          {thisFrameFlaggedCopy(scan.totalAffectedRatio)} · {formatScanTime(scan.capturedAt)}
        </p>
        {scan.scannedByName && <p className="mt-0.5 text-[11px] text-slate-400">by {scan.scannedByName}</p>}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-2 min-h-11 w-full rounded-full border border-slate-300 py-2 text-xs text-slate-500"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
