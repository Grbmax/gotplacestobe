import { Binary } from "mongodb";
import { getDb, hasMongo } from "./db";
import type { Detection } from "./types";

export type TrainingFrameDoc = {
  _id: string;
  scanId: string;
  propertyId: string;
  room: string;
  surface: string;
  contentType: string;
  /** Raw JPEG/PNG bytes — the training corpus. */
  bytes: Binary;
  byteLength: number;
  detections: Detection[];
  finding: string;
  detector:
    | "gemini"
    | "grok"
    | "mock"
    | "gemini+roboflow"
    | "grok+roboflow"
    | "ensemble"
    | "roboflow";
  capturedAt: string;
  source: "capture" | "upload";
  forTraining: true;
  scannedBy?: string;
  scannedByName?: string;
};

export type TrainingFrameMeta = Omit<TrainingFrameDoc, "bytes" | "_id"> & { id: string };

function parseDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1]!, bytes: Buffer.from(match[2]!, "base64") };
}

/** Always keep a binary copy in Mongo for future model training / export. */
export async function saveTrainingFrame(input: {
  scanId: string;
  propertyId: string;
  room: string;
  surface: string;
  imageDataUrl: string;
  detections: Detection[];
  finding: string;
  detector:
    | "gemini"
    | "grok"
    | "mock"
    | "gemini+roboflow"
    | "grok+roboflow"
    | "ensemble"
    | "roboflow";
  capturedAt: string;
  source?: "capture" | "upload";
  scannedBy?: string;
  scannedByName?: string;
}): Promise<boolean> {
  if (!hasMongo()) return false;
  const parsed = parseDataUrl(input.imageDataUrl);
  if (!parsed) {
    console.error("[frames] expected a data URL for training store");
    return false;
  }

  const doc: TrainingFrameDoc = {
    _id: input.scanId,
    scanId: input.scanId,
    propertyId: input.propertyId,
    room: input.room,
    surface: input.surface,
    contentType: parsed.contentType,
    bytes: new Binary(parsed.bytes),
    byteLength: parsed.bytes.length,
    detections: input.detections,
    finding: input.finding,
    detector: input.detector,
    capturedAt: input.capturedAt,
    source: input.source ?? "capture",
    forTraining: true,
    scannedBy: input.scannedBy,
    scannedByName: input.scannedByName,
  };

  const db = await getDb();
  await db.collection<TrainingFrameDoc>("frames").updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  return true;
}

export async function getTrainingFrameBytes(
  scanId: string,
): Promise<{ contentType: string; bytes: Buffer } | null> {
  if (!hasMongo()) return null;
  const db = await getDb();
  const doc = await db.collection<TrainingFrameDoc>("frames").findOne(
    { _id: scanId },
    { projection: { contentType: 1, bytes: 1 } },
  );
  if (!doc?.bytes) return null;
  const raw = doc.bytes as Binary;
  const bytes = Buffer.from(Uint8Array.from(raw.buffer));
  return { contentType: doc.contentType || "image/jpeg", bytes };
}

/** Metadata only — safe to list without shipping multi‑MB payloads. */
export async function listTrainingFrameMeta(limit = 100): Promise<TrainingFrameMeta[]> {
  if (!hasMongo()) return [];
  const db = await getDb();
  const docs = await db
    .collection<TrainingFrameDoc>("frames")
    .find({}, { projection: { bytes: 0 } })
    .sort({ capturedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}
