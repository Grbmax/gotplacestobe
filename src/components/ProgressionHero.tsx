"use client";

import Link from "next/link";
import { deltaCopy, flaggedPercent, trendLabel } from "@/lib/labels";
import type { SurfaceTrend } from "@/lib/progression";

type Props = {
  propertyId: string;
  trend: SurfaceTrend & { surfaceCount?: number; pairCount?: number };
};

export function ProgressionHero({ propertyId, trend }: Props) {
  const hasPair = trend.pairCount != null ? trend.pairCount > 0 : trend.direction !== "insufficient_data";
  const tone =
    trend.direction === "worsening"
      ? "border-rose-500/40 bg-rose-500/10"
      : trend.direction === "improving"
        ? "border-emerald-500/40 bg-emerald-500/10"
        : trend.direction === "stable"
          ? "border-zinc-600 bg-zinc-900"
          : "border-dashed border-zinc-700 bg-zinc-900/60";

  if (!hasPair) {
    return (
      <div className={`mt-4 rounded-2xl border p-4 ${tone}`}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Progression</p>
        <p className="mt-2 text-sm font-medium text-white">The instrument needs a second reading</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          One photo is a snapshot. Scan the same surface again later to measure how mold, seepage, or
          cracks have changed — that delta is the product.
        </p>
        <Link
          href={`/scan?propertyId=${propertyId}`}
          className="mt-4 inline-flex rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black"
        >
          Scan again to unlock progression
        </Link>
      </div>
    );
  }

  const firstPct = trend.first ? flaggedPercent(trend.first.totalAffectedRatio) : "—";
  const latestPct = trend.latest ? flaggedPercent(trend.latest.totalAffectedRatio) : "—";

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Progression</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
            trend.direction === "worsening"
              ? "bg-rose-500/20 text-rose-300"
              : trend.direction === "improving"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-zinc-500/20 text-zinc-300"
          }`}
        >
          {trend.direction === "worsening" ? "Worsening" : trendLabel(trend.direction)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-white">{firstPct}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">First</p>
        </div>
        <div className="flex items-center justify-center">
          <span className="text-zinc-500">→</span>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-white">{latestPct}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Latest</p>
        </div>
      </div>
      <p
        className={`mt-3 text-sm ${
          trend.deltaRatio > 0
            ? "text-rose-300"
            : trend.deltaRatio < 0
              ? "text-emerald-300"
              : "text-zinc-300"
        }`}
      >
        {deltaCopy(trend.deltaRatio)}
        {trend.pairCount != null && trend.pairCount > 1
          ? ` · ${trend.pairCount} surfaces with repeat scans`
          : ""}
      </p>
    </div>
  );
}
