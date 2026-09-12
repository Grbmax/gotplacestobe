"use client";

import { deltaCopy, flaggedPercent } from "@/lib/labels";
import type { Scan } from "@/lib/types";

type Props = {
  first: Scan;
  latest: Scan;
  deltaRatio: number;
};

export function CompareView({ first, latest, deltaRatio }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-white">
      <div className="grid grid-cols-2 gap-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.imageUrl} alt="First scan" className="aspect-[4/3] w-full rounded-xl object-cover bg-zinc-800" />
          <figcaption className="mt-2 text-xs text-zinc-400">
            First · {flaggedPercent(first.totalAffectedRatio)}% flagged
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={latest.imageUrl} alt="Latest scan" className="aspect-[4/3] w-full rounded-xl object-cover bg-zinc-800" />
          <figcaption className="mt-2 text-xs text-zinc-400">
            Latest · {flaggedPercent(latest.totalAffectedRatio)}% flagged
          </figcaption>
        </figure>
      </div>
      <p
        className={`mt-3 text-sm ${
          deltaRatio > 0 ? "text-rose-400" : deltaRatio < 0 ? "text-emerald-400" : "text-zinc-300"
        }`}
      >
        {deltaCopy(deltaRatio)}
      </p>
    </div>
  );
}
