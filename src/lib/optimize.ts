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

/** Cumulative count of distinct (room, surface) locations with at least one detection, photo by photo. */
export function cumulativeDefects(order: Scan[]): number[] {
  const found = new Set<string>();
  const out: number[] = [];
  for (const s of order) {
    if (s.detections.length > 0) found.add(`${s.room}::${s.surface}`);
    out.push(found.size);
  }
  return out;
}

export function totalDistinctDefects(scans: Scan[]): number {
  const found = new Set<string>();
  for (const s of scans) if (s.detections.length > 0) found.add(`${s.room}::${s.surface}`);
  return found.size;
}

/** Photos needed to reach `target` distinct defects found, or the full length if never reached. */
export function photosToReach(cumulative: number[], target: number): number {
  const idx = cumulative.findIndex((n) => n >= target);
  return idx === -1 ? cumulative.length : idx + 1;
}

export function guidedVsNaiveSummary(scans: Scan[]) {
  const total = totalDistinctDefects(scans);
  if (scans.length < 3 || total === 0) return null;
  const target = Math.max(1, Math.ceil(total * 0.8));
  const guidedAt80 = photosToReach(cumulativeDefects(guidedOrder(scans)), target);
  const naiveAt80 = photosToReach(cumulativeDefects(naiveOrder(scans)), target);
  const found = Math.min(total, target);
  return {
    total,
    found,
    guidedAt80,
    naiveAt80,
    sentence: `Guided capture found ${found} of ${total} defects in ${guidedAt80} photo${
      guidedAt80 === 1 ? "" : "s"
    }. Photographing lowest-risk surfaces first took ${naiveAt80} photo${
      naiveAt80 === 1 ? "" : "s"
    } to find the same.`,
  };
}
