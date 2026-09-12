import type { Scan } from "./types";

export type TrendDirection = "worsening" | "improving" | "stable" | "insufficient_data";

export type SurfaceTrend = {
  points: { at: string; ratio: number }[];
  first: Scan | null;
  latest: Scan | null;
  deltaRatio: number;
  percentChange: number | null;
  direction: TrendDirection;
};

/** Never mix seeded demo scans into real progression math. */
export function realScansOnly(scans: Scan[]): Scan[] {
  const real = scans.filter((s) => !s.isSample);
  return real.length ? real : [];
}

export function surfaceTrend(scans: Scan[]): SurfaceTrend {
  const sorted = [...realScansOnly(scans)].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );
  const points = sorted.map((s) => ({ at: s.capturedAt, ratio: s.totalAffectedRatio }));
  if (sorted.length < 2) {
    return {
      points,
      first: sorted[0] ?? null,
      latest: sorted[sorted.length - 1] ?? null,
      deltaRatio: 0,
      percentChange: null,
      direction: "insufficient_data",
    };
  }
  const first = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;
  const deltaRatio = latest.totalAffectedRatio - first.totalAffectedRatio;
  const percentChange =
    first.totalAffectedRatio === 0 ? null : (deltaRatio / first.totalAffectedRatio) * 100;
  let direction: TrendDirection = "stable";
  if (Math.abs(deltaRatio) < 0.01) direction = "stable";
  else if (deltaRatio > 0) direction = "worsening";
  else direction = "improving";

  return { points, first, latest, deltaRatio, percentChange, direction };
}

/** Worst surface-level direction across a property (sample-safe). */
export function propertyTrend(scans: Scan[]): SurfaceTrend & { surfaceCount: number; pairCount: number } {
  const real = realScansOnly(scans);
  const bySurface = new Map<string, Scan[]>();
  for (const s of real) {
    const key = `${s.room}::${s.surface}`;
    const list = bySurface.get(key);
    if (list) list.push(s);
    else bySurface.set(key, [s]);
  }

  const trends = [...bySurface.values()].map((list) => surfaceTrend(list));
  const withPairs = trends.filter((t) => t.direction !== "insufficient_data");
  const worsening = withPairs.filter((t) => t.direction === "worsening");
  const improving = withPairs.filter((t) => t.direction === "improving");

  // Property headline: any worsening surface wins; else improving if any; else stable/insufficient.
  let direction: TrendDirection = "insufficient_data";
  if (worsening.length) direction = "worsening";
  else if (improving.length) direction = "improving";
  else if (withPairs.length) direction = "stable";

  const overall = surfaceTrend(real);
  return {
    ...overall,
    direction: withPairs.length ? direction : overall.direction,
    surfaceCount: bySurface.size,
    pairCount: withPairs.length,
  };
}

export function civicAlong(
  points: { at: string; ratio: number }[],
  monthly?: { month: string; count: number }[],
): { at: string; ratio: number; count: number }[] {
  if (!points.length || !monthly?.length) return [];
  const by = new Map(monthly.map((m) => [m.month, m.count]));
  const max = Math.max(1, ...monthly.map((m) => m.count));
  return points.map((p) => {
    const count = by.get(p.at.slice(0, 7)) ?? 0;
    return { at: p.at, ratio: count / max, count };
  });
}
