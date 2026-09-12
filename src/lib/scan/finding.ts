import type { Detection } from "./types";

/** Thin wrapper: prefer Gemini's finding; template for mock-mode callers. */
export function findingSentence(
  finding: string | undefined,
  detections: Detection[],
  detector: "gemini" | "mock",
): string {
  if (finding?.trim()) return finding.trim();
  if (!detections.length) {
    return detector === "gemini"
      ? "No visible mold, seepage, cracking, or peeling detected."
      : "Preview only — no obvious defects in this frame.";
  }
  const top = [...detections].sort((a, b) => b.confidence - a.confidence)[0]!;
  const label = top.cls.replace(/_/g, " ");
  return detector === "gemini"
    ? `Possible ${label} visible (confidence ${(top.confidence * 100).toFixed(0)}%).`
    : `Preview only — looks like possible ${label}.`;
}
