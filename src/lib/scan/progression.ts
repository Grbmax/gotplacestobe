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
