import { nextBestSurface, surfacePlannerValue } from "./nextbest";
import type { Scan, SurfaceCoverage } from "./types";

function updateCoverage(coverage: SurfaceCoverage[], chosen: Scan) {
  const existing = coverage.find((c) => c.room === chosen.room && c.surface === chosen.surface);
  if (existing) {
    existing.scanCount += 1;
    existing.lastScannedAt = chosen.capturedAt;
    existing.lastDetections = chosen.detections;
  } else {
    coverage.push({
      room: chosen.room,
      surface: chosen.surface,
      scanCount: 1,
      lastScannedAt: chosen.capturedAt,
      lastDetections: chosen.detections,
    });
  }
}

/** Earliest remaining scan matching a predicate — not API order (newest-first). */
function pickEarliest(remaining: Scan[], pred: (s: Scan) => boolean): number {
  let best = -1;
  let bestT = Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const s = remaining[i]!;
    if (!pred(s)) continue;
    const t = new Date(s.capturedAt).getTime();
    if (t < bestT) {
      bestT = t;
      best = i;
    }
  }
  return best;
}

/**
 * Simulates "if the user had followed the guide from the start": at each
 * step, ask nextBestSurface() what it would recommend given only what's
 * been simulated as scanned so far, then take the earliest already-captured
 * scan of that surface. Falls back to the highest-value remaining surface
 * when the recommendation was never photographed.
 */
export function guidedOrder(scans: Scan[]): Scan[] {
  const remaining = [...scans];
  const order: Scan[] = [];
  const coverage: SurfaceCoverage[] = [];

  while (remaining.length) {
    const rec = nextBestSurface(coverage);
    let idx = pickEarliest(remaining, (s) => s.room === rec.room && s.surface === rec.surface);

    if (idx === -1) {
      // Recommended surface was never scanned — take the best available by the same value fn.
      let bestVal = -1;
      let bestKey = "";
      for (const s of remaining) {
        const v = surfacePlannerValue(s.room, s.surface, coverage);
        const key = `${s.room}::${s.surface}`;
        if (v > bestVal) {
          bestVal = v;
          bestKey = key;
        }
      }
      const [room, surface] = bestKey.split("::") as [string, string];
      idx = pickEarliest(remaining, (s) => s.room === room && s.surface === surface);
      if (idx === -1) idx = 0;
    }

    const chosen = remaining.splice(idx, 1)[0]!;
    order.push(chosen);
    updateCoverage(coverage, chosen);
  }
  return order;
}

/**
 * Unguided baseline: photograph lowest-risk surfaces first (anti-planner).
 * Capture order is a circular baseline when the walkthrough already followed
 * the guide — low-prior-first is what "naive photography" looks like without
 * a risk model.
 */
export function naiveOrder(scans: Scan[]): Scan[] {
  return [...scans].sort((a, b) => {
    const va = surfacePlannerValue(a.room, a.surface, []);
    const vb = surfacePlannerValue(b.room, b.surface, []);
    if (va !== vb) return va - vb; // ascending — opposite of the planner
    return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
  });
}

function surfaceKey(s: Scan) {
  return `${s.room}::${s.surface}`;
}

/** Cumulative count of distinct (room, surface) locations with at least one detection, photo by photo. */
export function cumulativeDefects(order: Scan[]): number[] {
  const found = new Set<string>();
  const out: number[] = [];
  for (const s of order) {
    if (s.detections.length > 0) found.add(surfaceKey(s));
    out.push(found.size);
  }
  return out;
}

export function totalDistinctDefects(scans: Scan[]): number {
  const found = new Set<string>();
  for (const s of scans) if (s.detections.length > 0) found.add(surfaceKey(s));
  return found.size;
}

/**
 * Photographing a surface reveals that surface's condition — represented by the
 * worst state ever measured there. Two photos of the same wall tell you about one
 * wall, so the comparison is over surfaces visited, not shutter presses: otherwise
 * an order is rewarded purely for which of several historical frames it happened
 * to replay first.
 */
export function surfaceSeverity(scans: Scan[]): Map<string, number> {
  const worst = new Map<string, number>();
  for (const s of scans) {
    const key = surfaceKey(s);
    worst.set(key, Math.max(worst.get(key) ?? 0, s.totalAffectedRatio));
  }
  return worst;
}

/**
 * Total damage on the property. Summing severity rather than counting surfaces is
 * what keeps a 0.8% paint speck from scoring the same as half a ceiling of mould —
 * the difference the planner exists to find first.
 */
export function totalDamage(scans: Scan[]): number {
  let sum = 0;
  for (const v of surfaceSeverity(scans).values()) sum += v;
  return sum;
}

/** Share of the property's damage surfaced, as a percentage, one point per new surface photographed. */
export function discoveryCurve(order: Scan[], severity: Map<string, number>, total: number): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  let sum = 0;
  for (const s of order) {
    const key = surfaceKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    sum += severity.get(key) ?? 0;
    out.push(total > 0 ? (sum / total) * 100 : 0);
  }
  return out;
}

/** Photos needed to reach `target`, or the full length if never reached. */
export function photosToReach(cumulative: number[], target: number): number {
  const idx = cumulative.findIndex((n) => n >= target);
  return idx === -1 ? cumulative.length : idx + 1;
}

export function guidedVsNaiveSummary(scans: Scan[]) {
  const total = totalDistinctDefects(scans);
  const severity = surfaceSeverity(scans);
  const damage = totalDamage(scans);
  if (scans.length < 3 || total === 0 || damage <= 0) return null;

  const guidedCurve = discoveryCurve(guidedOrder(scans), severity, damage);
  const naiveCurve = discoveryCurve(naiveOrder(scans), severity, damage);
  const guidedAt80 = photosToReach(guidedCurve, 80);
  const naiveAt80 = photosToReach(naiveCurve, 80);
  const photos = (n: number) => `${n} photo${n === 1 ? "" : "s"}`;
  const lead = `Guided capture surfaced 80% of this property's visible damage in ${photos(guidedAt80)}.`;
  const sentence =
    guidedAt80 < naiveAt80
      ? `${lead} Photographing lowest-risk surfaces first took ${photos(naiveAt80)} to reach the same.`
      : guidedAt80 === naiveAt80
        ? `${lead} Photographing lowest-risk surfaces first took the same number here — too few surfaces to separate the two orders.`
        : `${lead} Lowest-risk-first got there in ${photos(
            naiveAt80,
          )} — on this property the worst damage isn't where the risk priors expect it.`;

  return { total, guidedAt80, naiveAt80, guidedWins: guidedAt80 < naiveAt80, sentence };
}
