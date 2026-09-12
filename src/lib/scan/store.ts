import { getScanDb, hasMongo } from "../db";
import { persistImage } from "./blob";
import { runDetect } from "./detect";
import { totalAffectedRatio } from "./mockMath";
import type { Finding, Property, Review, Scan, SurfaceCoverage } from "./types";

type PropertyDoc = Omit<Property, "id"> & { _id: string };
type ScanDoc = Omit<Scan, "id"> & { _id: string };
type FindingDoc = Omit<Finding, "id"> & { _id: string };

const mem = {
  properties: [] as Property[],
  scans: [] as Scan[],
  findings: [] as Finding[],
  seeded: false,
};

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function weeksAgo(weeks: number) {
  return new Date(Date.now() - weeks * 7 * 24 * 3_600_000).toISOString();
}

function sampleSeed(): { property: Property; scans: Scan[]; findings: Finding[] } {
  const property: Property = {
    id: "prop_sample_beacon",
    label: "5614 Beacon St",
    kind: "lease",
    createdAt: weeksAgo(6),
  };
  const baseDetsEarly = [
    {
      cls: "mold" as const,
      confidence: 0.62,
      bbox: [0.32, 0.18, 0.22, 0.16] as [number, number, number, number],
      areaRatio: 0.04,
    },
  ];
  const baseDetsLate = [
    {
      cls: "mold" as const,
      confidence: 0.78,
      bbox: [0.28, 0.14, 0.3, 0.22] as [number, number, number, number],
      areaRatio: 0.08,
    },
    {
      cls: "water_seepage" as const,
      confidence: 0.55,
      bbox: [0.55, 0.2, 0.18, 0.14] as [number, number, number, number],
      areaRatio: 0.03,
    },
  ];
  const placeholder =
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect fill="#1c2618" width="100%" height="100%"/><text x="50%" y="48%" fill="#d6ff4a" font-size="22" text-anchor="middle" font-family="sans-serif">Sample ceiling vent</text></svg>`,
    ).toString("base64");

  const scans: Scan[] = [
    {
      id: "scan_sample_early",
      propertyId: property.id,
      room: "bathroom",
      surface: "ceiling_vent",
      imageUrl: placeholder,
      capturedAt: weeksAgo(5),
      detections: baseDetsEarly,
      totalAffectedRatio: 0.04,
      finding: "Sample — faint discoloration near the ceiling vent.",
      detector: "mock",
      isSample: true,
    },
    {
      id: "scan_sample_late",
      propertyId: property.id,
      room: "bathroom",
      surface: "ceiling_vent",
      imageUrl: placeholder,
      capturedAt: weeksAgo(0),
      detections: baseDetsLate,
      totalAffectedRatio: 0.11,
      finding: "Sample — mold and seepage marks have spread around the vent.",
      detector: "mock",
      isSample: true,
    },
  ];

  const findings: Finding[] = scans.flatMap((s) =>
    s.detections.map((d) => ({
      id: id("find"),
      scanId: s.id,
      propertyId: s.propertyId,
      room: s.room,
      surface: s.surface,
      cls: d.cls,
      confidence: d.confidence,
      bbox: d.bbox,
      areaRatio: d.areaRatio,
      explanation: s.finding,
      capturedAt: s.capturedAt,
    })),
  );

  return { property, scans, findings };
}

async function ensureSeed() {
  if (hasMongo()) {
    const db = await getScanDb();
    const count = await db.collection("properties").countDocuments();
    if (count > 0) return;
    const { property, scans, findings } = sampleSeed();
    await db.collection<PropertyDoc>("properties").insertOne({
      _id: property.id,
      label: property.label,
      kind: property.kind,
      createdAt: property.createdAt,
    });
    await db.collection<ScanDoc>("scans").insertMany(
      scans.map((s) => {
        const { id: scanId, ...rest } = s;
        return { _id: scanId, ...rest };
      }),
    );
    if (findings.length) {
      await db.collection<FindingDoc>("findings").insertMany(
        findings.map((f) => {
          const { id: findingId, ...rest } = f;
          return { _id: findingId, ...rest };
        }),
      );
    }
    return;
  }
  if (mem.seeded) return;
  const { property, scans, findings } = sampleSeed();
  mem.properties = [property];
  mem.scans = scans;
  mem.findings = findings;
  mem.seeded = true;
}

function asProperty(doc: PropertyDoc): Property {
  return { id: doc._id, label: doc.label, kind: doc.kind, createdAt: doc.createdAt };
}

function asScan(doc: ScanDoc): Scan {
  return {
    id: doc._id,
    propertyId: doc.propertyId,
    room: doc.room,
    surface: doc.surface,
    imageUrl: doc.imageUrl,
    capturedAt: doc.capturedAt,
    detections: doc.detections,
    totalAffectedRatio: doc.totalAffectedRatio,
    finding: doc.finding,
    detector: doc.detector,
    review: doc.review,
    isSample: doc.isSample,
  };
}

export async function listProperties(): Promise<Property[]> {
  await ensureSeed();
  if (!hasMongo()) return [...mem.properties].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const db = await getScanDb();
  const docs = await db.collection<PropertyDoc>("properties").find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(asProperty);
}

export async function createProperty(input: { label: string; kind: Property["kind"] }): Promise<Property> {
  await ensureSeed();
  const property: Property = {
    id: id("prop"),
    label: input.label.trim() || "Untitled stay",
    kind: input.kind,
    createdAt: new Date().toISOString(),
  };
  if (!hasMongo()) {
    mem.properties.unshift(property);
    return property;
  }
  const db = await getScanDb();
  await db.collection<PropertyDoc>("properties").insertOne({
    _id: property.id,
    label: property.label,
    kind: property.kind,
    createdAt: property.createdAt,
  });
  return property;
}

export async function listScans(filter: {
  propertyId?: string;
  room?: string;
  surface?: string;
}): Promise<Scan[]> {
  await ensureSeed();
  if (!hasMongo()) {
    return mem.scans
      .filter((s) => {
        if (filter.propertyId && s.propertyId !== filter.propertyId) return false;
        if (filter.room && s.room !== filter.room) return false;
        if (filter.surface && s.surface !== filter.surface) return false;
        return true;
      })
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }
  const db = await getScanDb();
  const q: Record<string, string> = {};
  if (filter.propertyId) q.propertyId = filter.propertyId;
  if (filter.room) q.room = filter.room;
  if (filter.surface) q.surface = filter.surface;
  const docs = await db.collection<ScanDoc>("scans").find(q).sort({ capturedAt: -1 }).toArray();
  return docs.map(asScan);
}

export async function getScan(scanId: string): Promise<Scan | null> {
  await ensureSeed();
  if (!hasMongo()) return mem.scans.find((s) => s.id === scanId) ?? null;
  const db = await getScanDb();
  const doc = await db.collection<ScanDoc>("scans").findOne({ _id: scanId });
  return doc ? asScan(doc) : null;
}

export async function listFindings(filter: { scanId?: string; propertyId?: string }): Promise<Finding[]> {
  await ensureSeed();
  if (!hasMongo()) {
    return mem.findings.filter((f) => {
      if (filter.scanId && f.scanId !== filter.scanId) return false;
      if (filter.propertyId && f.propertyId !== filter.propertyId) return false;
      return true;
    });
  }
  const db = await getScanDb();
  const q: Record<string, string> = {};
  if (filter.scanId) q.scanId = filter.scanId;
  if (filter.propertyId) q.propertyId = filter.propertyId;
  const docs = await db.collection<FindingDoc>("findings").find(q).toArray();
  return docs.map((d) => ({ id: d._id, ...d, _id: undefined }) as Finding);
}

export async function createScan(input: {
  propertyId: string;
  room: string;
  surface: string;
  image: string;
}): Promise<Scan> {
  await ensureSeed();
  const detected = await runDetect(input.image);
  const imageUrl = await persistImage(input.image, id("img"));
  const scan: Scan = {
    id: id("scan"),
    propertyId: input.propertyId,
    room: input.room.trim() || "room",
    surface: input.surface.trim() || "surface",
    imageUrl,
    capturedAt: new Date().toISOString(),
    detections: detected.detections,
    totalAffectedRatio: totalAffectedRatio(detected.detections),
    finding: detected.finding,
    detector: detected.detector,
  };

  const findings: Finding[] = detected.detections.map((d) => ({
    id: id("find"),
    scanId: scan.id,
    propertyId: scan.propertyId,
    room: scan.room,
    surface: scan.surface,
    cls: d.cls,
    confidence: d.confidence,
    bbox: d.bbox,
    areaRatio: d.areaRatio,
    explanation: scan.finding,
    capturedAt: scan.capturedAt,
  }));

  if (!hasMongo()) {
    mem.scans.unshift(scan);
    mem.findings.unshift(...findings);
    return scan;
  }
  const db = await getScanDb();
  const { id: scanId, ...rest } = scan;
  await db.collection<ScanDoc>("scans").insertOne({ _id: scanId, ...rest });
  if (findings.length) {
    await db.collection<FindingDoc>("findings").insertMany(
      findings.map((f) => {
        const { id: findingId, ...fRest } = f;
        return { _id: findingId, ...fRest };
      }),
    );
  }
  return scan;
}

export async function reviewScan(
  scanId: string,
  review: Omit<Review, "at"> & { note?: string },
): Promise<Scan | null> {
  await ensureSeed();
  const payload: Review = {
    verdict: review.verdict,
    reviewerRole: review.reviewerRole,
    note: review.note,
    at: new Date().toISOString(),
  };
  if (!hasMongo()) {
    const idx = mem.scans.findIndex((s) => s.id === scanId);
    if (idx < 0) return null;
    mem.scans[idx] = { ...mem.scans[idx]!, review: payload };
    return mem.scans[idx]!;
  }
  const db = await getScanDb();
  const updated = await db.collection<ScanDoc>("scans").findOneAndUpdate(
    { _id: scanId },
    { $set: { review: payload } },
    { returnDocument: "after" },
  );
  return updated ? asScan(updated) : null;
}

export async function surfaceCoverage(propertyId: string): Promise<SurfaceCoverage[]> {
  const scans = await listScans({ propertyId });
  const map = new Map<string, SurfaceCoverage>();
  for (const s of scans) {
    const key = `${s.room}::${s.surface}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        room: s.room,
        surface: s.surface,
        lastScannedAt: s.capturedAt,
        scanCount: 1,
      });
    } else {
      cur.scanCount += 1;
      if (!cur.lastScannedAt || s.capturedAt > cur.lastScannedAt) cur.lastScannedAt = s.capturedAt;
    }
  }
  return [...map.values()];
}
