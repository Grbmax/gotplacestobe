import type { Detection } from "./types";

const GRID = [
  ["top-left", "top-centre", "top-right"],
  ["centre-left", "centre", "centre-right"],
  ["bottom-left", "bottom-centre", "bottom-right"],
] as const;

/** 3×3 cell from bbox centroid. */
export function bboxPosition(bbox: [number, number, number, number]): string {
  const [x, y, w, h] = bbox;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const col = cx < 1 / 3 ? 0 : cx < 2 / 3 ? 1 : 2;
  const row = cy < 1 / 3 ? 0 : cy < 2 / 3 ? 1 : 2;
  return GRID[row]![col]!;
}

function certaintyWord(confidence: number): "possible" | "likely" | "clear" {
  const pct = confidence * 100;
  if (pct < 50) return "possible";
  if (pct <= 75) return "likely";
  return "clear";
}

/** Sentence from detections — position from bbox, certainty from confidence. */
export function sentenceFromDetections(detections: Detection[], ranModel: boolean): string {
  if (!detections.length) {
    return ranModel
      ? "No visible mold, seepage, cracking, or peeling detected."
      : "Preview only — no obvious defects in this frame.";
  }
  const top = [...detections].sort((a, b) => b.confidence - a.confidence)[0]!;
  const label = top.cls.replace(/_/g, " ");
  const certainty = certaintyWord(top.confidence);
  const where = bboxPosition(top.bbox);
  const areaPct = (top.areaRatio * 100).toFixed(1);
  const head = certainty === "clear" ? `Clear ${label}` : `${certainty[0]!.toUpperCase()}${certainty.slice(1)} ${label}`;
  const core = `${head}, ${where} — ${areaPct}% of this frame.`;
  return ranModel ? core : `Preview only — ${core.charAt(0).toLowerCase()}${core.slice(1)}`;
}

/** Thin wrapper: prefer Gemini's finding; template for mock-mode callers. */
export function findingSentence(
  finding: string | undefined,
  detections: Detection[],
  detector: "gemini" | "mock",
): string {
  if (finding?.trim()) return finding.trim();
  return sentenceFromDetections(detections, detector === "gemini");
}

/** Display sentence for a stored scan — re-derive from bbox when detections exist. */
export function displayFinding(scan: {
  finding: string;
  detections: Detection[];
  detector: string;
}): string {
  if (!scan.detections.length) return scan.finding;
  const ranModel = scan.detector !== "mock" && scan.detector !== "preview";
  return sentenceFromDetections(scan.detections, ranModel);
}
