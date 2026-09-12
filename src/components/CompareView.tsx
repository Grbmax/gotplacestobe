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
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-900">
      <div className="grid grid-cols-2 gap-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.imageUrl} alt="First scan" className="aspect-[4/3] w-full rounded-xl object-cover bg-slate-100" />
          <figcaption className="mt-2 text-xs text-slate-500">
            First · {flaggedPercent(first.totalAffectedRatio)}% flagged
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={latest.imageUrl} alt="Latest scan" className="aspect-[4/3] w-full rounded-xl object-cover bg-slate-100" />
          <figcaption className="mt-2 text-xs text-slate-500">
            Latest · {flaggedPercent(latest.totalAffectedRatio)}% flagged
          </figcaption>
        </figure>
      </div>
      <p
        className={`mt-3 text-sm ${
          deltaRatio > 0 ? "text-rose-600" : deltaRatio < 0 ? "text-emerald-700" : "text-slate-600"
        }`}
      >
        {deltaCopy(deltaRatio)}
      </p>
    </div>
  );
}
