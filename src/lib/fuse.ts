import type { Detection } from "./types";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function iou(a: Detection["bbox"], b: Detection["bbox"]): number {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a[2] * a[3] + b[2] * b[3] - inter;
  return union <= 0 ? 0 : inter / union;
}

export type FuseResult = {
  detections: Detection[];
  agreementRatio: number;
  geminiOnly: number;
  roboflowOnly: number;
  agreed: number;
};

const IOU_MATCH = 0.25;

/** Late-fusion: Gemini primary, Roboflow verifies / adds high-conf misses. */
export function fuseDetections(gemini: Detection[], roboflow: Detection[]): FuseResult {
  if (!roboflow.length) {
    return {
      detections: gemini,
      agreementRatio: 0,
      geminiOnly: gemini.length,
      roboflowOnly: 0,
      agreed: 0,
    };
  }
  if (!gemini.length) {
    return {
      detections: roboflow.filter((d) => d.confidence >= 0.55),
      agreementRatio: 0,
      geminiOnly: 0,
      roboflowOnly: roboflow.length,
      agreed: 0,
    };
  }

  const usedRf = new Set<number>();
  const fused: Detection[] = [];
  let agreed = 0;

  for (const g of gemini) {
    let bestIdx = -1;
    let bestIou = 0;
    for (let i = 0; i < roboflow.length; i++) {
      if (usedRf.has(i)) continue;
      const r = roboflow[i]!;
      if (r.cls !== g.cls) continue;
      const score = iou(g.bbox, r.bbox);
      if (score > bestIou) {
        bestIou = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestIou >= IOU_MATCH) {
      usedRf.add(bestIdx);
      const r = roboflow[bestIdx]!;
      agreed += 1;
      fused.push({
        ...g,
        confidence: clamp01(0.55 * g.confidence + 0.45 * r.confidence + 0.08),
        areaRatio: clamp01((g.areaRatio + r.areaRatio) / 2),
      });
    } else {
      // Gemini-only: keep but don't boost — RF didn't verify.
      fused.push({ ...g, confidence: clamp01(g.confidence * 0.92) });
    }
  }

  let roboflowOnly = 0;
  for (let i = 0; i < roboflow.length; i++) {
    if (usedRf.has(i)) continue;
    const r = roboflow[i]!;
    if (r.confidence < 0.6) continue;
    roboflowOnly += 1;
    fused.push(r);
  }

  return {
    detections: fused.sort((a, b) => b.confidence - a.confidence).slice(0, 8),
    agreementRatio: agreed / (fused.length || 1),
    geminiOnly: gemini.length - agreed,
    roboflowOnly,
    agreed,
  };
}
