"use client";

import type { Scan } from "@/lib/scan/types";

type Props = {
  first: Scan;
  latest: Scan;
  deltaRatio: number;
};

export function CompareView({ first, latest, deltaRatio }: Props) {
  const deltaPct = (deltaRatio * 100).toFixed(1);
  const sign = deltaRatio > 0 ? "+" : "";
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-3 text-ink">
      <div className="grid grid-cols-2 gap-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={first.imageUrl}
            alt="First scan"
            className="aspect-[4/3] w-full rounded-xl bg-moss/15 object-cover"
          />
          <figcaption className="mt-2 text-xs text-ink/50">
            First · {(first.totalAffectedRatio * 100).toFixed(1)}%
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={latest.imageUrl}
            alt="Latest scan"
            className="aspect-[4/3] w-full rounded-xl bg-moss/15 object-cover"
          />
          <figcaption className="mt-2 text-xs text-ink/50">
            Latest · {(latest.totalAffectedRatio * 100).toFixed(1)}%
          </figcaption>
        </figure>
      </div>
      <p className="mt-3 text-sm">
        Delta{" "}
        <span
          className={
            deltaRatio > 0 ? "text-urgent" : deltaRatio < 0 ? "text-moss" : "text-ink/60"
          }
        >
          {sign}
          {deltaPct} pts
        </span>
      </p>
    </div>
  );
}
