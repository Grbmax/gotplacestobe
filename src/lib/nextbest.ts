import type { CivicPulse, Detection, Scan, SurfaceCoverage } from "./types";

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

/** The single most ambiguous confidence from the last read — near 0.5 means the model genuinely couldn't tell. */
function mostAmbiguous(lastDetections: Detection[] | undefined): { confidence: number; ambiguity: number } | null {
  if (!lastDetections?.length) return null;
  let worst = lastDetections[0]!;
  let worstAmbiguity = -1;
  for (const d of lastDetections) {
    const ambiguity = 1 - Math.abs(d.confidence - 0.5) * 2;
    if (ambiguity > worstAmbiguity) {
      worstAmbiguity = ambiguity;
      worst = d;
    }
  }
  return { confidence: worst.confidence, ambiguity: worstAmbiguity };
}

/** Ambiguous surfaces are worth revisiting, up to double their base value — a checklist doesn't do this, a planner does. */
function uncertaintyBoost(lastDetections: Detection[] | undefined) {
  const worst = mostAmbiguous(lastDetections);
  return worst ? 1 + worst.ambiguity : 1;
}

const UNCERTAIN_THRESHOLD = 0.6; // ambiguity above this is worth calling out by name

function reasonFor(cov: SurfaceCoverage | undefined, prior: number) {
  const bits: string[] = [];
  const ambiguous = mostAmbiguous(cov?.lastDetections);
  if (ambiguous && ambiguous.ambiguity >= UNCERTAIN_THRESHOLD) {
    bits.push(`Last read was uncertain (${ambiguous.confidence.toFixed(2)})`);
  } else if (!cov || cov.scanCount === 0) {
    bits.push("Never scanned");
  } else if (cov.scanCount < 2) {
    bits.push("Only one scan");
  } else {
    bits.push("Due for a recheck");
  }
  if (prior >= 0.85) bits.push("high-risk surface");
  else if (prior >= 0.65) bits.push("elevated risk");
  else bits.push("routine check");
  return bits.join(" · ");
}

export function coverageFromScans(scans: Scan[]): SurfaceCoverage[] {
  const map = new Map<string, SurfaceCoverage>();
  for (const s of scans) {
    const key = `${s.room}::${s.surface}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        room: s.room,
        surface: s.surface,
        lastScannedAt: s.capturedAt,
        scanCount: 1,
        lastDetections: s.detections,
      });
    } else {
      cur.scanCount += 1;
      if (s.capturedAt > cur.lastScannedAt) {
        cur.lastScannedAt = s.capturedAt;
        cur.lastDetections = s.detections;
      }
    }
  }
  return [...map.values()];
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
    const uncertainty = uncertaintyBoost(cov?.lastDetections);
    const value = prior * (1 - coverage) * decay * uncertainty;
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
