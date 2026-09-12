"use client";

import { DetectorBadge } from "@/components/scan/DetectorBadge";
import type { Scan } from "@/lib/scan/types";

type Props = {
  scan: Scan;
  onSelect?: () => void;
};

export function ScanCard({ scan, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-ink/10 bg-paper p-3 text-left text-ink shadow-sm"
    >
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scan.imageUrl} alt="" className="h-16 w-16 rounded-xl bg-moss/20 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {scan.room} / {scan.surface.replace(/_/g, " ")}
            </p>
            <DetectorBadge detector={scan.detector} sample={scan.isSample} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-ink/55">{scan.finding}</p>
          <p className="mt-2 text-xs text-moss">
            {(scan.totalAffectedRatio * 100).toFixed(1)}% affected ·{" "}
            {new Date(scan.capturedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </button>
  );
}
