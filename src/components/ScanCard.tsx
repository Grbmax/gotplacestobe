"use client";

import { DetectorBadge } from "@/components/DetectorBadge";
import type { Scan } from "@/lib/types";

type Props = {
  scan: Scan;
  onSelect?: () => void;
};

export function ScanCard({ scan, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left text-white"
    >
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scan.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover bg-zinc-800" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {scan.room} / {scan.surface.replace(/_/g, " ")}
            </p>
            <DetectorBadge detector={scan.detector} sample={scan.isSample} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{scan.finding}</p>
          <p className="mt-2 text-xs text-emerald-300">
            {(scan.totalAffectedRatio * 100).toFixed(1)}% affected ·{" "}
            {new Date(scan.capturedAt).toLocaleDateString()}
          </p>
          {scan.scannedByName && <p className="mt-0.5 text-[11px] text-zinc-500">by {scan.scannedByName}</p>}
        </div>
      </div>
    </button>
  );
}
