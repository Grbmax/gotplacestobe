import type { Detection } from "./types";

/**
 * Client-only aiming guides. Never hits the network.
 * Intentionally returns no defect claims — live %/class labels were
 * fake mock math and were reading as "mold 70%" before shutter.
 */
export function livePreview(_frameWidth: number, _frameHeight: number): Detection[] {
  return [];
}
