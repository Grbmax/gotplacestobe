import type { DefectClass, Detection } from "./types";

type RoboflowPrediction = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence?: number;
  class?: string;
  class_name?: string;
};

type RoboflowResponse = {
  predictions?: RoboflowPrediction[];
  image?: { width?: number; height?: number };
};

/** Trained project in your workspace — always project/VERSION (first train is usually /1). */
export const DEFAULT_ROBOFLOW_MODEL =
  process.env.ROBOFLOW_MODEL_ID?.trim() || "building-defect-on-walls-smfwl/1";

const MAX_CONCURRENT = Math.min(
  10,
  Math.max(1, Number(process.env.ROBOFLOW_MAX_CONCURRENT) || 10),
);
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;

const CLASS_ALIASES: Record<string, DefectClass> = {
  mold: "mold",
  mould: "mold",
  mildew: "mold",
  fungus: "mold",
  water_seepage: "water_seepage",
  "water-seepage": "water_seepage",
  waterseepage: "water_seepage",
  water_damage: "water_seepage",
  "water-damage": "water_seepage",
  waterdamage: "water_seepage",
  damp: "water_seepage",
  moisture: "water_seepage",
  seepage: "water_seepage",
  crack: "crack",
  cracks: "crack",
  stairstep_crack: "crack",
  "stair-step-crack": "crack",
  stairstepcrack: "crack",
  peeling_paint: "peeling_paint",
  "peeling-paint": "peeling_paint",
  peelingpaint: "peeling_paint",
  paint_peel: "peeling_paint",
};

/** RF-only / RF-verify: softer than Gemini sanitize — model already scored the box. */
function filterRoboflowDetections(detections: Detection[]): Detection[] {
  return detections.filter((d) => {
    const min = d.cls === "mold" ? 0.4 : 0.35;
    return d.confidence >= min && d.areaRatio >= 0.002;
  });
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function mapClass(raw: string | undefined): DefectClass | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return CLASS_ALIASES[key] ?? null;
}

export function hasRoboflow(): boolean {
  return Boolean(process.env.ROBOFLOW_API_KEY?.trim());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
}

const gate = new Semaphore(MAX_CONCURRENT);

function parsePredictions(json: RoboflowResponse): Detection[] {
  const imgW = Math.max(1, Number(json.image?.width) || 1);
  const imgH = Math.max(1, Number(json.image?.height) || 1);
  const out: Detection[] = [];

  const rawClasses: string[] = [];
  for (const p of json.predictions ?? []) {
    const rawName = p.class ?? p.class_name;
    if (rawName) rawClasses.push(String(rawName));
    const cls = mapClass(rawName);
    if (!cls) {
      if (rawName) console.warn("[roboflow] unmapped class:", rawName);
      continue;
    }
    const pw = Number(p.width) || 0;
    const ph = Number(p.height) || 0;
    const cx = Number(p.x) || 0;
    const cy = Number(p.y) || 0;
    const x = clamp01((cx - pw / 2) / imgW);
    const y = clamp01((cy - ph / 2) / imgH);
    const w = clamp01(pw / imgW);
    const h = clamp01(ph / imgH);
    if (w <= 0.003 || h <= 0.003) continue;
    out.push({
      cls,
      confidence: clamp01(Number(p.confidence) || 0),
      bbox: [x, y, w, h],
      areaRatio: clamp01(w * h),
    });
  }
  if (rawClasses.length) {
    console.info("[roboflow] raw classes:", rawClasses.join(", "));
  } else if ((json.predictions?.length ?? 0) === 0) {
    console.info("[roboflow] no predictions from model");
  }
  return filterRoboflowDetections(out);
}

async function fetchWithBackoff(
  modelId: string,
  body: string,
  apiKey: string,
): Promise<RoboflowResponse | null> {
  // Lower API floor so weak-but-real mold isn't dropped before our filter.
  const endpoint = `https://serverless.roboflow.com/${modelId}?confidence=25&overlap=40`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(25_000),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 150);
      console.warn(`[roboflow] 429 — backoff ${backoff}ms (attempt ${attempt + 1})`);
      if (attempt === MAX_RETRIES) return null;
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[roboflow] HTTP", res.status, text.slice(0, 240));
      return null;
    }

    return (await res.json()) as RoboflowResponse;
  }
  return null;
}

/** CV verifier — trained building-defect model. Failures return [] (scan still works). */
export async function detectWithRoboflow(
  imageDataUrl: string,
  modelId = DEFAULT_ROBOFLOW_MODEL,
): Promise<Detection[]> {
  const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
  if (!apiKey) return [];

  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(imageDataUrl);
  const base64 = match?.[2] ?? imageDataUrl.replace(/^data:[^;]+;base64,/, "");
  if (!base64) return [];

  const id = modelId.includes("/") ? modelId : `${modelId}/1`;

  try {
    return await gate.run(async () => {
      const json = await fetchWithBackoff(id, base64, apiKey);
      if (!json) return [];
      return parsePredictions(json);
    });
  } catch (err) {
    console.error("[roboflow] inference failed", err);
    return [];
  }
}
