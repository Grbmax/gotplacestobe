import { GoogleGenAI, Type } from "@google/genai";
import { fuseDetections } from "./fuse";
import type { Detection } from "./types";
import { mockDetections, mockFinding, sanitizeDetections } from "./mockMath";
import { detectWithRoboflow, hasRoboflow } from "./roboflow";

export interface Detector {
  name: "gemini" | "mock";
  detect(imageDataUrl: string): Promise<{ detections: Detection[]; finding: string }>;
}

class MockDetector implements Detector {
  name = "mock" as const;
  async detect(imageDataUrl: string) {
    const seed = String(imageDataUrl.length);
    const detections = mockDetections(`shot:${seed}`, -0.5);
    return { detections, finding: mockFinding(detections) };
  }
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          cls: {
            type: Type.STRING,
            enum: ["mold", "water_seepage", "crack", "peeling_paint"],
          },
          confidence: { type: Type.NUMBER },
          bbox: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            minItems: 4,
            maxItems: 4,
          },
          areaRatio: { type: Type.NUMBER },
        },
        required: ["cls", "confidence", "bbox", "areaRatio"],
      },
    },
    finding: { type: Type.STRING },
  },
  required: ["detections", "finding"],
};

class GeminiDetector implements Detector {
  name = "gemini" as const;

  async detect(imageDataUrl: string) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Missing GEMINI_API_KEY");

    const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(imageDataUrl);
    const mimeType = match?.[1] ?? "image/jpeg";
    const data = match?.[2] ?? imageDataUrl.replace(/^data:[^;]+;base64,/, "");

    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = [
      "You are doing a rental move-in inspection photo of an interior or exterior surface.",
      "Look only for clear, unambiguous: mold, water_seepage, cracks, peeling_paint.",
      "Be conservative. Dirt, dust, shadows, normal discoloration, wood grain, and camera noise are NOT defects.",
      "Do NOT label something as mold unless you are clearly confident it is mold (fuzzy/spotty biological growth), not just a dark stain.",
      "If unsure, omit the detection. Prefer detections: [] over a false positive.",
      "confidence must reflect certainty (0.55–0.7 = uncertain but plausible; ≥0.8 = clear). Do not invent high confidence.",
      "Return JSON matching the schema. bbox is [x,y,w,h] normalized 0..1 relative to the image.",
      "areaRatio is the share of the frame occupied by that defect (0..1) — do not exaggerate.",
      "If the surface looks clean, return detections: [] and a finding saying no visible defects.",
      "finding must be one plain-English sentence; if empty detections, say nothing concerning was found.",
    ].join(" ");

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text ?? "{}";
    let parsed: { detections?: unknown; finding?: unknown };
    try {
      parsed = JSON.parse(text) as { detections?: unknown; finding?: unknown };
    } catch {
      throw new Error("Gemini returned non-JSON");
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
}

function selectDetector(): Detector {
  const override = process.env.DETECTOR?.toLowerCase();
  if (override === "mock") return new MockDetector();
  if (override === "gemini" || process.env.GEMINI_API_KEY) return new GeminiDetector();
  return new MockDetector();
}

function appendVerifyNote(finding: string, agreed: number, rfOnly: number): string {
  if (agreed > 0) {
    return `${finding} (Roboflow verified ${agreed} region${agreed === 1 ? "" : "s"}.)`;
  }
  if (rfOnly > 0) {
    return `${finding} (Roboflow also flagged additional high-confidence regions.)`;
  }
  return finding;
}

const mock = new MockDetector();

export type DetectorKind = "gemini" | "mock" | "gemini+roboflow" | "roboflow";

export type DetectResult = {
  detections: Detection[];
  finding: string;
  detector: DetectorKind;
};

function findingFromDetections(detections: Detection[], source: "roboflow" | "mock"): string {
  if (!detections.length) {
    return source === "roboflow"
      ? "No visible mold, seepage, cracking, or peeling detected."
      : "Preview only — no obvious defects in this frame.";
  }
  const top = [...detections].sort((a, b) => b.confidence - a.confidence)[0]!;
  const label = top.cls.replace(/_/g, " ");
  return source === "roboflow"
    ? `Possible ${label} visible (confidence ${(top.confidence * 100).toFixed(0)}%).`
    : `Preview only — looks like possible ${label}.`;
}

/** Gemini primary; Roboflow verifies. If Gemini is down (e.g. quota), Roboflow is used alone — never invent Mock boxes when RF is available. */
export async function runDetect(imageDataUrl: string): Promise<DetectResult> {
  const preferred = selectDetector();
  let primary: { detections: Detection[]; finding: string } | null = null;
  let base: "gemini" | "mock" | null = null;

  if (preferred.name === "mock") {
    primary = await preferred.detect(imageDataUrl);
    base = "mock";
  } else {
    try {
      primary = await preferred.detect(imageDataUrl);
      base = "gemini";
    } catch (err) {
      console.error("[detect] Gemini failed; will try Roboflow then mock", err);
    }
  }

  // Forced mock mode — skip RF.
  if (base === "mock" && primary) {
    return { ...primary, detector: "mock" };
  }

  if (hasRoboflow()) {
    try {
      const rf = await detectWithRoboflow(imageDataUrl);

      // Gemini down → Roboflow alone (real CV, not seeded mock).
      if (!primary || base !== "gemini") {
        return {
          detections: rf,
          finding: findingFromDetections(rf, "roboflow"),
          detector: "roboflow",
        };
      }

      if (!rf.length) return { ...primary, detector: "gemini" };

      const fused = fuseDetections(primary.detections, rf);
      return {
        detections: fused.detections,
        finding: appendVerifyNote(primary.finding, fused.agreed, fused.roboflowOnly),
        detector: fused.agreed > 0 || fused.roboflowOnly > 0 ? "gemini+roboflow" : "gemini",
      };
    } catch (err) {
      console.error("[detect] Roboflow failed", err);
      if (primary && base === "gemini") return { ...primary, detector: "gemini" };
    }
  }

  if (primary && base === "gemini") return { ...primary, detector: "gemini" };

  const fallback = await mock.detect(imageDataUrl);
  return { ...fallback, detector: "mock" };
}
