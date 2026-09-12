import { GoogleGenAI, Type } from "@google/genai";
import { fuseDetections } from "./fuse";
import { sentenceFromDetections } from "./finding";
import { detectWithGrok, hasGrok } from "./grok";
import type { Detection } from "./types";
import { mockDetections, mockFinding, sanitizeDetections } from "./mockMath";
import { detectWithRoboflow, hasRoboflow } from "./roboflow";

type PassResult = { detections: Detection[]; finding: string };

class MockDetector {
  name = "mock" as const;
  async detect(imageDataUrl: string): Promise<PassResult> {
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

class GeminiDetector {
  name = "gemini" as const;

  async detect(imageDataUrl: string): Promise<PassResult> {
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

function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function forcedMock() {
  return process.env.DETECTOR?.toLowerCase() === "mock";
}

function findingFromDetections(detections: Detection[], source: "roboflow" | "mock"): string {
  return sentenceFromDetections(detections, source === "roboflow");
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.toLowerCase().includes("quota");
}

function pickFinding(a?: string, b?: string) {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (left && right) return left.length >= right.length ? left : right;
  return left || right || "No visible mold, seepage, cracking, or peeling detected.";
}

function mergeLlmPasses(
  gemini: PassResult | null,
  grok: PassResult | null,
): { result: PassResult; sources: ("gemini" | "grok")[] } | null {
  if (!gemini && !grok) return null;
  if (gemini && !grok) return { result: gemini, sources: ["gemini"] };
  if (!gemini && grok) return { result: grok, sources: ["grok"] };

  const fused = fuseDetections(gemini!.detections, grok!.detections);
  return {
    result: {
      detections: fused.detections,
      finding: pickFinding(gemini!.finding, grok!.finding),
    },
    sources: ["gemini", "grok"],
  };
}

function labelFor(sources: ("gemini" | "grok")[], usedRf: boolean): DetectorKind {
  const hasG = sources.includes("gemini");
  const hasX = sources.includes("grok");
  if (hasG && hasX && usedRf) return "ensemble";
  if (hasG && hasX) return "ensemble";
  if (hasG && usedRf) return "gemini+roboflow";
  if (hasX && usedRf) return "grok+roboflow";
  if (usedRf && !hasG && !hasX) return "roboflow";
  if (hasG) return "gemini";
  if (hasX) return "grok";
  return "mock";
}

const mock = new MockDetector();
const gemini = new GeminiDetector();

export type DetectorKind =
  | "gemini"
  | "grok"
  | "roboflow"
  | "gemini+roboflow"
  | "grok+roboflow"
  | "ensemble"
  | "mock";

export type DetectResult = {
  detections: Detection[];
  finding: string;
  detector: DetectorKind;
  /** True only when every real pass failed — never when RF/Grok/Gemini saved the reading. */
  degraded?: boolean;
  passes?: { gemini?: boolean; grok?: boolean; roboflow?: boolean };
};

/**
 * Multi-pass detection:
 *  1) Gemini + Grok in parallel (whichever keys exist)
 *  2) Roboflow as final judgment / verifier
 * Failures are swallowed when a later pass succeeds — the tenant never sees an outage badge
 * unless every real detector is down.
 */
export async function runDetect(imageDataUrl: string): Promise<DetectResult> {
  if (forcedMock()) {
    const result = await mock.detect(imageDataUrl);
    return { ...result, detector: "mock" };
  }

  const geminiP = hasGemini()
    ? gemini.detect(imageDataUrl).then(
        (r) => ({ ok: true as const, r }),
        (err) => {
          console.error("[detect] Gemini pass failed", err);
          return { ok: false as const, err };
        },
      )
    : Promise.resolve({ ok: false as const, err: new Error("no gemini key") });

  const grokP = hasGrok()
    ? detectWithGrok(imageDataUrl).then(
        (r) => ({ ok: true as const, r }),
        (err) => {
          console.error("[detect] Grok pass failed", err);
          return { ok: false as const, err };
        },
      )
    : Promise.resolve({ ok: false as const, err: new Error("no grok key") });

  const [geminiOut, grokOut] = await Promise.all([geminiP, grokP]);
  const geminiRes = geminiOut.ok ? geminiOut.r : null;
  const grokRes = grokOut.ok ? grokOut.r : null;
  const llm = mergeLlmPasses(geminiRes, grokRes);
  const sources = llm?.sources ?? [];

  let rf: Detection[] | null = null;
  if (hasRoboflow()) {
    try {
      rf = await detectWithRoboflow(imageDataUrl);
    } catch (err) {
      console.error("[detect] Roboflow judgment failed", err);
    }
  }

  // Roboflow is the last line of judgment when LLMs are down or empty of signal.
  if (rf && !llm) {
    return {
      detections: rf,
      finding: findingFromDetections(rf, "roboflow"),
      detector: "roboflow",
      passes: { gemini: Boolean(geminiRes), grok: Boolean(grokRes), roboflow: true },
    };
  }

  if (llm && rf) {
    const fused = fuseDetections(llm.result.detections, rf);
    const usedRf = fused.agreed > 0 || fused.roboflowOnly > 0 || !llm.result.detections.length;
    const finding =
      fused.agreed > 0
        ? `${llm.result.finding} (Cross-checked with on-device CV.)`
        : fused.roboflowOnly > 0
          ? `${llm.result.finding} (CV also flagged additional high-confidence regions.)`
          : llm.result.finding;
    return {
      detections: fused.detections,
      finding,
      detector: labelFor(sources, usedRf || Boolean(rf.length)),
      passes: { gemini: Boolean(geminiRes), grok: Boolean(grokRes), roboflow: true },
    };
  }

  if (llm) {
    return {
      ...llm.result,
      detector: labelFor(sources, false),
      passes: { gemini: Boolean(geminiRes), grok: Boolean(grokRes), roboflow: false },
    };
  }

  // Every real pass failed — this is the only tenant-visible outage path.
  const err = geminiOut.ok ? null : geminiOut.err;
  const finding = err
    ? isQuotaError(err)
      ? "Detection services are temporarily unavailable (quota). This is not a real reading — retry shortly."
      : "Detection services are temporarily unavailable. This is not a real reading — please retry."
    : findingFromDetections([], "mock");

  return {
    detections: [],
    finding,
    detector: "mock",
    degraded: true,
    passes: { gemini: false, grok: false, roboflow: false },
  };
}
