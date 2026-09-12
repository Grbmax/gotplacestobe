import type { Detection } from "./types";
import { mockDetections } from "./mockMath";

/**
 * Client-only live preview boxes. Never hits the network.
 * Deterministic from frame size + ~1s time bucket so overlays don't strobe.
 */
export function livePreview(frameWidth: number, frameHeight: number): Detection[] {
  const w = Math.max(1, Math.round(frameWidth));
  const h = Math.max(1, Math.round(frameHeight));
  return mockDetections(`live:${w}x${h}`, 0.4);
}
