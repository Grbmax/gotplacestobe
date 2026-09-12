import type { Scan } from "./types";

export function surfaceTrend(scans: Scan[]): {
  points: { at: string; ratio: number }[];
  first: Scan | null;
  latest: Scan | null;
  deltaRatio: number;
  percentChange: number | null;
  direction: "worsening" | "improving" | "stable" | "insufficient_data";
} {
  const sorted = [...scans].sort(
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
  let direction: "worsening" | "improving" | "stable" = "stable";
  if (Math.abs(deltaRatio) < 0.01) direction = "stable";
  else if (deltaRatio > 0) direction = "worsening";
  else direction = "improving";

  return { points, first, latest, deltaRatio, percentChange, direction };
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
