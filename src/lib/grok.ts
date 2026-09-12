import type { Detection } from "./types";
import { sanitizeDetections } from "./mockMath";

const XAI_BASE = "https://api.x.ai/v1";

export function hasGrok() {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

function apiKey() {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new Error("Missing XAI_API_KEY");
  return key;
}

const DETECT_PROMPT = [
  "You are inspecting a rental move-in photo of an interior or exterior building surface.",
  "Look only for clear, unambiguous: mold, water_seepage, cracks, peeling_paint.",
  "Be conservative. Dirt, dust, shadows, normal discoloration, wood grain, and camera noise are NOT defects.",
  "If unsure, omit the detection. Prefer an empty detections array over a false positive.",
  "Return STRICT JSON only (no markdown) matching:",
  '{"detections":[{"cls":"mold|water_seepage|crack|peeling_paint","confidence":0-1,"bbox":[x,y,w,h],"areaRatio":0-1}],"finding":"one sentence"}',
  "bbox is [x,y,w,h] normalized 0..1. areaRatio is share of the frame (0..1).",
  "If clean, detections: [] and finding saying no visible defects.",
].join(" ");

/** Grok vision pass — structured defect detection via xAI chat completions. */
export async function detectWithGrok(
  imageDataUrl: string,
): Promise<{ detections: Detection[]; finding: string }> {
  const model = process.env.XAI_VISION_MODEL?.trim() || "grok-4.6";
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DETECT_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok vision HTTP ${res.status}: ${text.slice(0, 240)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "{}";
  let parsed: { detections?: unknown; finding?: unknown };
  try {
    parsed = JSON.parse(raw) as { detections?: unknown; finding?: unknown };
  } catch {
    throw new Error("Grok returned non-JSON");
  }

  const detections = sanitizeDetections(parsed.detections);
  const finding =
    typeof parsed.finding === "string" && parsed.finding.trim() && detections.length
      ? parsed.finding.trim()
      : detections.length
        ? "Visible surface defects detected in this frame."
        : "No visible mold, seepage, cracking, or peeling detected.";

  return { detections, finding };
}

/**
 * Grok Imagine — generate a plain-language educational still of what untreated
 * progression can look like. Never shown as a real photo of this unit.
 */
export async function imagineProgressionStill(input: {
  finding: string;
  room: string;
  surface: string;
  classes: string[];
}): Promise<string | null> {
  if (!hasGrok()) return null;
  const labels = input.classes.length ? input.classes.join(", ") : "surface wear";
  const prompt = [
    "Documentary educational illustration, not a real photograph of a specific home.",
    `Show how untreated ${labels} on a ${input.room} ${input.surface.replace(/_/g, " ")} can worsen over months.`,
    "Stylized cross-section / before-after collage, clinical and calm, no gore, no people.",
    `Context note for the illustrator: ${input.finding}`,
  ].join(" ");

  try {
    const res = await fetch(`${XAI_BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_IMAGINE_MODEL?.trim() || "grok-imagine-image-quality",
        prompt,
        n: 1,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[grok-imagine] HTTP", res.status, text.slice(0, 200));
      return null;
    }
    const payload = (await res.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const first = payload.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    return null;
  } catch (err) {
    console.error("[grok-imagine] failed", err);
    return null;
  }
}
