import { GoogleGenAI, Type } from "@google/genai";
import type { Detection } from "./types";
import { mockDetections, mockFinding, sanitizeDetections } from "./mockMath";

export interface Detector {
  name: "gemini" | "mock";
  detect(imageDataUrl: string): Promise<{ detections: Detection[]; finding: string }>;
}

class MockDetector implements Detector {
  name = "mock" as const;
  async detect(imageDataUrl: string) {
    const seed = String(imageDataUrl.length);
    const detections = mockDetections(`shot:${seed}`, 0.2);
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
            enum: ["mold", "water_seepage", "crack", "peeling_paint", "infestation"],
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
      "You are inspecting a photo of a building interior surface for rental damage indicators.",
      "Look only for: mold, water_seepage, cracks, peeling_paint, and optional infestation signs.",
      "Return JSON matching the schema. bbox is [x,y,w,h] normalized 0..1 relative to the image.",
      "areaRatio is the share of the frame occupied by that defect (0..1).",
      "If the surface looks clean, return detections: [] and a finding saying no visible defects.",
      "Use soft language (possible / consistent with) — this is documentation, not a certified inspection.",
      "finding must be one plain-English sentence describing what is visible and how concerning it is.",
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
      typeof parsed.finding === "string" && parsed.finding.trim()
        ? parsed.finding.trim()
        : detections.length
          ? "Visible surface defects detected in this frame."
          : "No visible mold, seepage, cracking, peeling, or infestation signs detected.";

    return { detections, finding };
  }
}

function selectDetector(): Detector {
  const override = process.env.DETECTOR?.toLowerCase();
  if (override === "mock") return new MockDetector();
  if (override === "gemini" || process.env.GEMINI_API_KEY) return new GeminiDetector();
  return new MockDetector();
}

const mock = new MockDetector();

/** Run detection. Gemini when configured; on any Gemini failure, fall back to mock for that request. */
export async function runDetect(
  imageDataUrl: string,
): Promise<{ detections: Detection[]; finding: string; detector: "gemini" | "mock" }> {
  const preferred = selectDetector();
  if (preferred.name === "mock") {
    const result = await preferred.detect(imageDataUrl);
    return { ...result, detector: "mock" };
  }
  try {
    const result = await preferred.detect(imageDataUrl);
    return { ...result, detector: "gemini" };
  } catch (err) {
    console.error("[detect] Gemini failed, falling back to mock", err);
    const result = await mock.detect(imageDataUrl);
    return { ...result, detector: "mock" };
  }
}
