"use client";

import { DetectorBadge } from "@/components/DetectorBadge";
import { escalationSentence, roomSurfaceLabel, thisFrameFlaggedCopy } from "@/lib/labels";
import type { Scan } from "@/lib/types";

type Props = {
  scan: Scan;
  onSelect?: () => void;
  onDelete?: () => void;
};

export function ScanCard({ scan, onSelect, onDelete }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left text-white">
      <button type="button" onClick={onSelect} className="flex w-full gap-3 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scan.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover bg-zinc-800" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{roomSurfaceLabel(scan.room, scan.surface, " / ")}</p>
            <DetectorBadge detector={scan.detector} sample={scan.isSample} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{scan.finding}</p>
          {scan.escalations?.[0] && (
            <p className="mt-1 text-[11px] leading-snug text-rose-300">
              {escalationSentence(scan.escalations[0])}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            {thisFrameFlaggedCopy(scan.totalAffectedRatio)} · {new Date(scan.capturedAt).toLocaleDateString()}
          </p>
          {scan.scannedByName && <p className="mt-0.5 text-[11px] text-zinc-500">by {scan.scannedByName}</p>}
        </div>
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
