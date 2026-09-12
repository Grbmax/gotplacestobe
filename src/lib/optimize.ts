import { nextBestSurface } from "./nextbest";
import type { Scan, SurfaceCoverage } from "./types";

/**
 * Simulates "if the user had followed the guide from the start": at each
 * step, ask nextBestSurface() what it would recommend given only what's
 * been simulated as scanned so far, then take whichever already-captured
 * scan matches that recommendation. This runs the real planner, not a
 * fabricated ordering — it's retrospective because we can't ask the user
 * to scan the same property twice for a demo.
 */
export function guidedOrder(scans: Scan[]): Scan[] {
  const remaining = [...scans];
  const order: Scan[] = [];
  const coverage: SurfaceCoverage[] = [];

  while (remaining.length) {
    const rec = nextBestSurface(coverage);
    let idx = remaining.findIndex((s) => s.room === rec.room && s.surface === rec.surface);
    if (idx === -1) idx = 0; // recommended surface was never actually scanned — take what's next best available

    const chosen = remaining.splice(idx, 1)[0]!;
    order.push(chosen);

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
  return order;
}

/** The order the photos were actually taken in. */
export function naiveOrder(scans: Scan[]): Scan[] {
  return [...scans].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
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
