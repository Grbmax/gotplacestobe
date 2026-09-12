"use client";

import { useState } from "react";
import { BoxOverlay } from "@/components/BoxOverlay";
import { citationLines } from "@/lib/articleVi";
import type { Scan } from "@/lib/types";

export function PhotoEvidence({ scan, className = "" }: { scan: Scan; className?: string }) {
  const [size, setSize] = useState({ w: 640, h: 480 });
  const cites = citationLines(scan.detections);
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-xl bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scan.imageUrl}
          alt=""
          className="aspect-[4/3] w-full object-cover"
          onLoad={(e) => {
            const img = e.currentTarget;
            setSize({ w: img.clientWidth, h: img.clientHeight });
          }}
        />
        <BoxOverlay
          detections={scan.detections}
          width={size.w}
          height={size.h}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="mt-1.5 text-[11px] leading-snug text-zinc-400">
        {new Date(scan.capturedAt).toLocaleString()} · {(scan.totalAffectedRatio * 100).toFixed(1)}% coverage
        {cites[0] ? ` · ${cites[0]}` : ""}
      </figcaption>
    </figure>
  );
}
