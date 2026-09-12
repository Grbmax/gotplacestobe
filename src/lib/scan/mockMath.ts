import type { DefectClass, Detection } from "./types";

const CLASSES: DefectClass[] = [
  "mold",
  "water_seepage",
  "crack",
  "peeling_paint",
  "infestation",
];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared mock math — used by MockDetector and livePreview. */
export function mockDetections(seedKey: string, countBias = 0): Detection[] {
  const bucket = Math.floor(Date.now() / 1000);
  const rand = mulberry32(hashStr(`${seedKey}:${bucket}`));
  const n = Math.min(3, Math.max(0, Math.floor(rand() * 3.2 + countBias)));
  const out: Detection[] = [];
  for (let i = 0; i < n; i++) {
    const clsRoll = rand();
    const cls: DefectClass =
      clsRoll < 0.36
        ? "mold"
        : clsRoll < 0.66
          ? "water_seepage"
          : clsRoll < 0.82
            ? "crack"
            : clsRoll < 0.94
              ? "peeling_paint"
              : "infestation";
    const w = 0.08 + rand() * 0.22;
    const h = 0.08 + rand() * 0.2;
    const x = 0.05 + rand() * (0.9 - w);
    const y = 0.05 + rand() * (0.9 - h);
    const areaRatio = clamp01(w * h * (0.55 + rand() * 0.45));
    out.push({
      cls,
      confidence: 0.45 + rand() * 0.47,
      bbox: [clamp01(x), clamp01(y), clamp01(w), clamp01(h)],
      areaRatio,
    });
  }
  return out;
}

export function mockFinding(detections: Detection[]): string {
  if (!detections.length) {
    return "Preview only — no obvious mold, seepage, cracking, peeling, or infestation signs in this frame.";
  }
  const top = [...detections].sort((a, b) => b.confidence - a.confidence)[0]!;
  const label = top.cls.replace(/_/g, " ");
  return `Preview only — looks like possible ${label} near center-left.`;
}

export function sanitizeDetections(raw: unknown): Detection[] {
  if (!Array.isArray(raw)) return [];
  const out: Detection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const cls = d.cls as string;
    if (!CLASSES.includes(cls as DefectClass)) continue;
    const bboxRaw = d.bbox;
    if (!Array.isArray(bboxRaw) || bboxRaw.length < 4) continue;
    const bbox: [number, number, number, number] = [
      clamp01(Number(bboxRaw[0])),
      clamp01(Number(bboxRaw[1])),
      clamp01(Number(bboxRaw[2])),
      clamp01(Number(bboxRaw[3])),
    ];
    out.push({
      cls: cls as DefectClass,
      confidence: clamp01(Number(d.confidence)),
      bbox,
      areaRatio: clamp01(Number(d.areaRatio ?? bbox[2] * bbox[3])),
    });
  }
  return out;
}

export function totalAffectedRatio(detections: Detection[]) {
  return clamp01(detections.reduce((s, d) => s + d.areaRatio, 0));
}

export { CLASSES as DEFECT_CLASSES };
