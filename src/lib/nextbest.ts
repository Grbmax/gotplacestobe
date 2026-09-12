import type { CivicPulse, SurfaceCoverage } from "./types";

const PRIORS: Record<string, number> = {
  bathroom_ceiling: 0.95,
  under_sink: 0.9,
  window_frame: 0.85,
  exterior_wall: 0.75,
  behind_furniture: 0.7,
  around_vent: 0.7,
  basement_wall: 0.85,
  closet_corner: 0.6,
  kitchen_backsplash: 0.55,
  ceiling_general: 0.5,
  wall_general: 0.35,
};

export const KNOWN_SURFACES: { room: string; surface: string; key: string }[] = [
  { room: "bathroom", surface: "ceiling_vent", key: "bathroom_ceiling" },
  { room: "bathroom", surface: "under_sink", key: "under_sink" },
  { room: "bathroom", surface: "around_vent", key: "around_vent" },
  { room: "kitchen", surface: "under_sink", key: "under_sink" },
  { room: "kitchen", surface: "backsplash", key: "kitchen_backsplash" },
  { room: "living", surface: "window_frame", key: "window_frame" },
  { room: "living", surface: "behind_furniture", key: "behind_furniture" },
  { room: "basement", surface: "wall", key: "basement_wall" },
  { room: "bedroom", surface: "closet_corner", key: "closet_corner" },
  { room: "exterior", surface: "wall", key: "exterior_wall" },
  { room: "any", surface: "ceiling", key: "ceiling_general" },
  { room: "any", surface: "wall", key: "wall_general" },
];

function priorRisk(surfaceKey: string) {
  return PRIORS[surfaceKey] ?? 0.4;
}

function coverageScore(scanCount: number) {
  // Capped below 1 so a well-covered surface can never be fully zeroed out —
  // otherwise recencyDecay could never bring it back into rotation after a
  // long gap, even though "due for a recheck" is a reason string we actually emit.
  return Math.min(scanCount / 2, 1) * 0.85;
}

function recencyDecay(lastScannedAt: string | null) {
  if (!lastScannedAt) return 1;
  const hours = (Date.now() - new Date(lastScannedAt).getTime()) / 3_600_000;
  return Math.min(Math.max(hours, 0) / 168, 1);
}

function reasonFor(cov: SurfaceCoverage | undefined, prior: number) {
  const bits: string[] = [];
  if (!cov || cov.scanCount === 0) bits.push("never scanned");
  else if (cov.scanCount < 2) bits.push("only one scan");
  else bits.push("due for a recheck");
  if (prior >= 0.85) bits.push("high-risk surface");
  else if (prior >= 0.65) bits.push("elevated risk");
  else bits.push("routine check");
  return bits.join(" · ");
}

export function nextBestSurface(
  covered: SurfaceCoverage[],
  civic?: CivicPulse,
): {
  room: string;
  surface: string;
  reason: string;
} {
  const byKey = new Map(covered.map((c) => [`${c.room}::${c.surface}`, c]));
  let best = KNOWN_SURFACES[0]!;
  let bestScore = -1;
  let bestCov: SurfaceCoverage | undefined;

  for (const s of KNOWN_SURFACES) {
    const cov = byKey.get(`${s.room}::${s.surface}`);
    let prior = priorRisk(s.key);
    if (civic?.waterNearby && (s.key === "under_sink" || s.key === "basement_wall")) {
      prior *= 1.85;
    }
    const coverage = coverageScore(cov?.scanCount ?? 0);
    const decay = recencyDecay(cov?.lastScannedAt ?? null);
    const value = prior * (1 - coverage) * decay;
    if (value > bestScore) {
      bestScore = value;
      best = s;
      bestCov = cov;
    }
  }

  const boosted = civic?.waterNearby && (best.key === "under_sink" || best.key === "basement_wall");
  return {
    room: best.room,
    surface: best.surface,
    reason: boosted && civic?.prompt ? civic.prompt : reasonFor(bestCov, priorRisk(best.key)),
  };
}
