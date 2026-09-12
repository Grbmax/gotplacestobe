"use client";

import type { Detection } from "@/lib/types";

const COLORS: Record<string, string> = {
  mold: "#7dffc3",
  water_seepage: "#5eb8ff",
  crack: "#ffb020",
  peeling_paint: "#ff6b6b",
};

type Props = {
  detections: Detection[];
  width: number;
  height: number;
  className?: string;
  /** false = live preview: plain, unlabeled, no class/confidence claims. Never look like a real result. */
  labeled?: boolean;
};

export function BoxOverlay({ detections, width, height, className, labeled = true }: Props) {
  return (
    <canvas
      className={className}
      width={Math.max(1, Math.round(width))}
      height={Math.max(1, Math.round(height))}
      ref={(canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const d of detections) {
          const [nx, ny, nw, nh] = d.bbox;
          const x = nx * canvas.width;
          const y = ny * canvas.height;
          const w = nw * canvas.width;
          const h = nh * canvas.height;

          if (!labeled) {
            // Aiming guide only — no class/confidence, since it's a client-side
            // placeholder, not a real read, and a wrong-looking label undermines
            // trust before the real detection even runs.
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
            continue;
          }

          const color = COLORS[d.cls] ?? "#fff";
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          const label = `${d.cls.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${Math.round(d.confidence * 100)}%`;
          ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
          const tw = ctx.measureText(label).width + 8;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, Math.max(0, y - 18), tw, 18);
          ctx.fillStyle = color;
          ctx.fillText(label, x + 4, Math.max(12, y - 5));
        }
      }}
    />
  );
}
