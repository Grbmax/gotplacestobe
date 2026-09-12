import { persistImage } from "./blob";
import { hasMongo, getDb } from "./db";
import { runDetect } from "./detect";
import { escalateDetections } from "./escalate";
import { totalAffectedRatio } from "./mockMath";
import { displayAddress, lookupCityContext, placeKeyFromAddress } from "./pgh";
import type { Property, Review, Role, Scan, SurfaceCoverage } from "./types";

type PropertyDoc = Omit<Property, "id"> & { _id: string };
type ScanDoc = Omit<Scan, "id"> & { _id: string };
type IdentityDoc = { _id: string; name: string; role: Role };

const mem = {
  properties: [] as Property[],
  scans: [] as Scan[],
  identities: new Map<string, IdentityDoc>(),
  seeded: false,
  mongoSeeded: false,
};

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function weeksAgo(weeks: number) {
  return new Date(Date.now() - weeks * 7 * 24 * 3_600_000).toISOString();
}

export const SAMPLE_PROPERTY_ID = "prop_sample_beacon";

function sampleSeed(): { property: Property; scans: Scan[] } {
  const property: Property = {
    id: SAMPLE_PROPERTY_ID,
    label: "5614 Beacon St",
    kind: "lease",
    createdAt: weeksAgo(6),
    placeKey: placeKeyFromAddress("5614 Beacon St"),
    isSample: true,
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
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect fill="#2a2a2a" width="100%" height="100%"/><text x="50%" y="48%" fill="#aaa" font-size="22" text-anchor="middle" font-family="sans-serif">Sample ceiling vent</text></svg>`,
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
  return { property, scans };
}

async function ensureSeed() {
  if (hasMongo()) {
    if (mem.mongoSeeded) return;
    const db = await getDb();
    const count = await db.collection("properties").countDocuments();
    if (count > 0) {
      mem.mongoSeeded = true;
      return;
    }
    const { property, scans } = sampleSeed();
    try {
      await db.collection<PropertyDoc>("properties").insertOne({
        _id: property.id,
        label: property.label,
        kind: property.kind,
        createdAt: property.createdAt,
        placeKey: property.placeKey,
        isSample: property.isSample,
      });
      await db.collection<ScanDoc>("scans").insertMany(
        scans.map((s) => {
          const { id, ...rest } = s;
          return { _id: id, ...rest };
        }),
      );
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
    mem.mongoSeeded = true;
    return;
  }
  if (mem.seeded) return;
  const { property, scans } = sampleSeed();
  mem.properties = [property];
  mem.scans = scans;
  mem.seeded = true;
}

function asProperty(doc: PropertyDoc): Property {
  const label = doc.label;
  return {
    id: doc._id,
    label,
    kind: doc.kind,
    createdAt: doc.createdAt,
    unit: doc.unit,
    placeKey: doc.placeKey || placeKeyFromAddress(label),
    cityContext: doc.cityContext,
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    isSample: doc.isSample,
  };
}

function clientImageUrl(scanId: string, imageUrl: string): string {
  if (imageUrl.startsWith("data:")) return `/api/scans/${scanId}/image`;
  return imageUrl;
}

function asScan(doc: ScanDoc): Scan {
  return {
    id: doc._id,
    propertyId: doc.propertyId,
    room: doc.room,
    surface: doc.surface,
    imageUrl: clientImageUrl(doc._id, doc.imageUrl),
    capturedAt: doc.capturedAt,
    detections: doc.detections,
    totalAffectedRatio: doc.totalAffectedRatio,
    finding: doc.finding,
    detector: doc.detector,
    review: doc.review,
    isSample: doc.isSample,
    scannedBy: doc.scannedBy,
    scannedByName: doc.scannedByName,
    escalations: doc.escalations,
  };
}

export async function listProperties(): Promise<Property[]> {
  await ensureSeed();
  await consolidateDuplicateHouses();
  if (!hasMongo()) return [...mem.properties].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const db = await getDb();
  const docs = await db.collection<PropertyDoc>("properties").find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(asProperty);
}

function keyOf(property: Property) {
  return property.placeKey || placeKeyFromAddress(property.label);
}

async function reassignScans(fromId: string, toId: string) {
  if (fromId === toId) return;
  if (!hasMongo()) {
    for (const s of mem.scans) {
      if (s.propertyId === fromId) s.propertyId = toId;
    }
    return;
  }
  const db = await getDb();
  await db.collection("scans").updateMany({ propertyId: fromId }, { $set: { propertyId: toId } });
}

async function deletePropertyRecord(id: string) {
  if (!hasMongo()) {
    mem.properties = mem.properties.filter((p) => p.id !== id);
    return;
  }
  const db = await getDb();
  await db.collection<PropertyDoc>("properties").deleteOne({ _id: id });
}

async function consolidateDuplicateHouses() {
  const props = !hasMongo()
    ? [...mem.properties]
    : (await (await getDb()).collection<PropertyDoc>("properties").find({}).toArray()).map(asProperty);
  const groups = new Map<string, Property[]>();
  for (const p of props) {
    const key = keyOf(p);
    if (!key.split("|")[0]) continue;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  for (const [placeKey, group] of groups) {
    if (group.length < 2) {
      const only = group[0];
      if (only && !only.placeKey) {
        only.placeKey = placeKey;
        if (!hasMongo()) {
          const i = mem.properties.findIndex((p) => p.id === only.id);
          if (i >= 0) mem.properties[i] = only;
        } else {
          const db = await getDb();
          await db.collection<PropertyDoc>("properties").updateOne({ _id: only.id }, { $set: { placeKey } });
        }
      }
      continue;
    }
    const withCounts = await Promise.all(
      group.map(async (p) => ({ p, n: (await listScans({ propertyId: p.id })).length })),
    );
    withCounts.sort((a, b) => b.n - a.n || a.p.createdAt.localeCompare(b.p.createdAt));
    const keep = withCounts[0]!.p;
    keep.placeKey = placeKey;
    for (const extra of withCounts.slice(1)) {
      await reassignScans(extra.p.id, keep.id);
      await deletePropertyRecord(extra.p.id);
    }
    if (!hasMongo()) {
      const i = mem.properties.findIndex((p) => p.id === keep.id);
      if (i >= 0) mem.properties[i] = { ...keep, placeKey };
    } else {
      const db = await getDb();
      await db.collection<PropertyDoc>("properties").updateOne({ _id: keep.id }, { $set: { placeKey } });
    }
  }
}

export async function createProperty(input: {
  label: string;
  kind: Property["kind"];
  unit?: string;
  createdBy?: string;
  createdByName?: string;
}): Promise<{ property: Property; reused: boolean }> {
  await ensureSeed();
  const raw = [input.label.trim(), input.unit?.trim() ? `Apt ${input.unit.trim()}` : ""].filter(Boolean).join(" ");
  const placeKey = placeKeyFromAddress(raw);
  const existing = (await listProperties()).find((p) => keyOf(p) === placeKey);
  if (existing) return { property: existing, reused: true };

  const cityContext = await lookupCityContext(raw);
  const property: Property = {
    id: id("prop"),
    label: displayAddress(raw),
    kind: input.kind,
    createdAt: new Date().toISOString(),
    unit: input.unit?.trim() || undefined,
    placeKey,
    cityContext,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
  };
  if (!hasMongo()) {
    mem.properties.unshift(property);
    return { property, reused: false };
  }
  const db = await getDb();
  await db.collection<PropertyDoc>("properties").insertOne({
    _id: property.id,
    label: property.label,
    kind: property.kind,
    createdAt: property.createdAt,
    unit: property.unit,
    placeKey: property.placeKey,
    cityContext: property.cityContext,
    createdBy: property.createdBy,
    createdByName: property.createdByName,
  });
  return { property, reused: false };
}

export async function getProperty(propertyId: string): Promise<Property | null> {
  await ensureSeed();
  if (!hasMongo()) return mem.properties.find((p) => p.id === propertyId) ?? null;
  const db = await getDb();
  const doc = await db.collection<PropertyDoc>("properties").findOne({ _id: propertyId });
  return doc ? asProperty(doc) : null;
}

export async function refreshPropertyCity(propertyId: string): Promise<Property | null> {
  const existing = await getProperty(propertyId);
  if (!existing) return null;
  const cityContext = await lookupCityContext(existing.label);
  existing.cityContext = cityContext;
  if (!hasMongo()) {
    const i = mem.properties.findIndex((p) => p.id === propertyId);
    if (i >= 0) mem.properties[i] = existing;
    return existing;
  }
  const db = await getDb();
  await db.collection<PropertyDoc>("properties").updateOne({ _id: propertyId }, { $set: { cityContext } });
  return existing;
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
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .map((s) => ({ ...s, imageUrl: clientImageUrl(s.id, s.imageUrl) }));
  }
  const db = await getDb();
  const q: Record<string, string> = {};
  if (filter.propertyId) q.propertyId = filter.propertyId;
  if (filter.room) q.room = filter.room;
  if (filter.surface) q.surface = filter.surface;
  const docs = await db.collection<ScanDoc>("scans").find(q).sort({ capturedAt: -1 }).toArray();
  return docs.map(asScan);
}

export async function getScan(id: string): Promise<Scan | null> {
  await ensureSeed();
  if (!hasMongo()) {
    const scan = mem.scans.find((s) => s.id === id) ?? null;
    return scan ? { ...scan, imageUrl: clientImageUrl(scan.id, scan.imageUrl) } : null;
  }
  const db = await getDb();
  const doc = await db.collection<ScanDoc>("scans").findOne({ _id: id });
  return doc ? asScan(doc) : null;
}

export async function getScanImage(
  id: string,
): Promise<{ kind: "url"; url: string } | { kind: "bytes"; contentType: string; bytes: Buffer } | null> {
  await ensureSeed();
  let imageUrl: string | undefined;
  if (!hasMongo()) {
    imageUrl = mem.scans.find((s) => s.id === id)?.imageUrl;
  } else {
    const db = await getDb();
    const doc = await db.collection<ScanDoc>("scans").findOne({ _id: id }, { projection: { imageUrl: 1 } });
    imageUrl = doc?.imageUrl;
  }
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return { kind: "url", url: imageUrl };
  }
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(imageUrl);
  if (!match) return null;
  return {
    kind: "bytes",
    contentType: match[1]!,
    bytes: Buffer.from(match[2]!, "base64"),
  };
}

export async function createScan(input: {
  propertyId: string;
  room: string;
  surface: string;
  image: string;
  scannedBy?: string;
  scannedByName?: string;
}): Promise<{ scan: Scan } | { error: string }> {
  await ensureSeed();
  const property = await getProperty(input.propertyId);
  if (!property) return { error: "Unknown property" };
  if (property.id === SAMPLE_PROPERTY_ID) {
    return { error: "Create your own property before scanning — the sample one is demo data only" };
  }

  const detected = await runDetect(input.image);
  const civic = escalateDetections(detected.detections, property?.cityContext);
  const detections = civic.detections;
  const finding = civic.findingExtra
    ? `${detected.finding} ${civic.findingExtra}`
    : detected.finding;
  const imageUrl = await persistImage(input.image, id("img"));
  const scan: Scan = {
    id: id("scan"),
    propertyId: input.propertyId,
    room: input.room.trim() || "room",
    surface: input.surface.trim() || "surface",
    imageUrl,
    capturedAt: new Date().toISOString(),
    detections,
    totalAffectedRatio: totalAffectedRatio(detections),
    finding,
    detector: detected.detector,
    escalations: civic.escalations.length ? civic.escalations : undefined,
    scannedBy: input.scannedBy,
    scannedByName: input.scannedByName,
  };

  if (!hasMongo()) {
    mem.scans.unshift(scan);
    return { scan: { ...scan, imageUrl: clientImageUrl(scan.id, scan.imageUrl) } };
  }
  const db = await getDb();
  const { id: scanId, ...rest } = scan;
  await db.collection<ScanDoc>("scans").insertOne({ _id: scanId, ...rest });
  return { scan: { ...scan, imageUrl: clientImageUrl(scan.id, scan.imageUrl) } };
}

export async function deleteScan(id: string): Promise<boolean> {
  await ensureSeed();
  if (!hasMongo()) {
    const before = mem.scans.length;
    mem.scans = mem.scans.filter((s) => s.id !== id);
    return mem.scans.length < before;
  }
  const db = await getDb();
  const res = await db.collection<ScanDoc>("scans").deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export async function reviewScan(
  id: string,
  review: Omit<Review, "at"> & { note?: string },
): Promise<Scan | null> {
  await ensureSeed();
  const payload: Review = {
    verdict: review.verdict,
    reviewerRole: review.reviewerRole,
    reviewerId: review.reviewerId,
    reviewerName: review.reviewerName,
    note: review.note,
    at: new Date().toISOString(),
  };
  if (!hasMongo()) {
    const idx = mem.scans.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    mem.scans[idx] = { ...mem.scans[idx]!, review: payload };
    return mem.scans[idx]!;
  }
  const db = await getDb();
  const updated = await db.collection<ScanDoc>("scans").findOneAndUpdate(
    { _id: id },
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
      // listScans returns newest-first, so the first hit per key is the latest scan.
      map.set(key, {
        room: s.room,
        surface: s.surface,
        lastScannedAt: s.capturedAt,
        scanCount: 1,
        lastDetections: s.detections,
      });
    } else {
      cur.scanCount += 1;
      if (!cur.lastScannedAt || s.capturedAt > cur.lastScannedAt) cur.lastScannedAt = s.capturedAt;
    }
  }
  return [...map.values()];
}

export async function propertySummaries() {
  const properties = await listProperties();
  const out = [];
  for (const p of properties) {
    const scans = await listScans({ propertyId: p.id });
    const last = scans[0] ?? null;
    const worst = scans.reduce((m, s) => Math.max(m, s.totalAffectedRatio), 0);
    out.push({ property: p, lastScannedAt: last?.capturedAt ?? null, worstRatio: worst, scanCount: scans.length });
  }
  return out;
}

export async function getIdentityRole(authId: string): Promise<Role | null> {
  if (!hasMongo()) return mem.identities.get(authId)?.role ?? null;
  const db = await getDb();
  const doc = await db.collection<IdentityDoc>("identities").findOne({ _id: authId });
  return doc?.role ?? null;
}

export async function setIdentityRole(authId: string, name: string, role: Role): Promise<void> {
  if (!hasMongo()) {
    mem.identities.set(authId, { _id: authId, name, role });
    return;
  }
  const db = await getDb();
  await db
    .collection<IdentityDoc>("identities")
    .updateOne({ _id: authId }, { $set: { name, role } }, { upsert: true });
}
