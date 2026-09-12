import { persistImage } from "./blob";
import { hasMongo, getDb } from "./db";
import { runDetect } from "./detect";
import { escalateDetections } from "./escalate";
import { getTrainingFrameBytes, saveTrainingFrame } from "./frames";
import { totalAffectedRatio } from "./mockMath";
import { landlordPortfolioSeed } from "./landlordPortfolio";
import { isLandlordPortfolio } from "./persona";
import { displayAddress, fillCityContextFromNearbyHouses, lookupCityContext, placeKeyFromAddress } from "./pgh";
import type { Property, Review, Role, Scan, SurfaceCoverage, Walk, WalkKind } from "./types";

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
    if (!mem.mongoSeeded) {
      const db = await getDb();
      const count = await db.collection("properties").countDocuments();
      if (count > 0) {
        // Self-heal: an old seed run (before `isSample` existed on this schema) can leave
        // the sample property without the flag, which silently defeats every guard that
        // checks it — never scan onto it, never reuse it as an address match, etc.
        await db
          .collection<PropertyDoc>("properties")
          .updateOne({ _id: SAMPLE_PROPERTY_ID }, { $set: { isSample: true } });
      } else {
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
      }
      mem.mongoSeeded = true;
    }
    await ensureLandlordPortfolio();
    return;
  }
  if (!mem.seeded) {
    const { property, scans } = sampleSeed();
    mem.properties = [property];
    mem.scans = scans;
    mem.seeded = true;
  }
  await ensureLandlordPortfolio();
}

let landlordSeededThisInstance = false;

async function ensureLandlordPortfolio() {
  if (landlordSeededThisInstance) return;
  const seeds = landlordPortfolioSeed();
  if (!hasMongo()) {
    for (const { property, scans } of seeds) {
      if (!mem.properties.some((p) => p.id === property.id)) mem.properties.push(property);
      else {
        const i = mem.properties.findIndex((p) => p.id === property.id);
        if (i >= 0) mem.properties[i] = { ...mem.properties[i]!, ...property, landlordPortfolio: true };
      }
      const have = new Set(mem.scans.filter((s) => s.propertyId === property.id).map((s) => s.id));
      for (const scan of scans) {
        if (!have.has(scan.id)) mem.scans.push(scan);
      }
    }
    landlordSeededThisInstance = true;
    return;
  }
  const db = await getDb();
  for (const { property, scans } of seeds) {
    const { id, ...rest } = property;
    await db.collection<PropertyDoc>("properties").updateOne(
      { _id: id },
      {
        $set: {
          ...rest,
          landlordPortfolio: true,
        },
      },
      { upsert: true },
    );
    const existing = await db.collection<ScanDoc>("scans").countDocuments({ propertyId: id });
    if (existing > 0) continue;
    try {
      await db.collection<ScanDoc>("scans").insertMany(
        scans.map((s) => {
          const { id: scanId, ...scanRest } = s;
          return { _id: scanId, ...scanRest };
        }),
      );
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  landlordSeededThisInstance = true;
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
    landlordPortfolio: doc.landlordPortfolio,
    walks: doc.walks,
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
    walkId: doc.walkId,
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
    degraded: doc.degraded,
    imagineUrl: doc.imagineUrl,
  };
}

let consolidatedThisInstance = false;

export async function listProperties(): Promise<Property[]> {
  await ensureSeed();
  // This sweep does O(duplicate groups) Mongo round-trips (listScans + reassign + delete
  // per extra property) — fine once, but it was running on every single property read,
  // including inside createProperty's own dedup check, so it compounded with every test
  // property created tonight and made basic page loads hang. Once per server instance.
  if (!consolidatedThisInstance) {
    await consolidateDuplicateHouses();
    consolidatedThisInstance = true;
  }
  if (!hasMongo()) return [...mem.properties].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const db = await getDb();
  const docs = await db.collection<PropertyDoc>("properties").find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(asProperty);
}

function addressKey(property: Property) {
  const raw =
    property.unit && !/\b(?:apt|apartment|unit|#)\b/i.test(property.label)
      ? `${property.label} Apt ${property.unit}`
      : property.label;
  return placeKeyFromAddress(raw);
}

async function patchProperty(id: string, patch: Partial<Property>) {
  if (!hasMongo()) {
    const i = mem.properties.findIndex((p) => p.id === id);
    if (i >= 0) mem.properties[i] = { ...mem.properties[i]!, ...patch };
    return;
  }
  const db = await getDb();
  await db.collection<PropertyDoc>("properties").updateOne({ _id: id }, { $set: patch });
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
    // The sample property is fixed demo data — never a merge/keep candidate, and never
    // a deletion target. Without this, any real property sharing its address gets
    // silently deleted here (it always "loses" to the sample's seeded scan count).
    if (p.isSample || isLandlordPortfolio(p)) continue;
    const key = addressKey(p);
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
    const extraWalks = withCounts.slice(1).flatMap((row) => row.p.walks ?? []);
    const walks = [...(keep.walks ?? []), ...extraWalks].filter(
      (w, i, all) => all.findIndex((x) => x.id === w.id) === i,
    );
    keep.placeKey = placeKey;
    keep.label = displayAddress(keep.label);
    keep.walks = walks;
    for (const extra of withCounts.slice(1)) {
      await reassignScans(extra.p.id, keep.id);
      await deletePropertyRecord(extra.p.id);
    }
    if (!hasMongo()) {
      const i = mem.properties.findIndex((p) => p.id === keep.id);
      if (i >= 0) mem.properties[i] = { ...keep, placeKey, label: keep.label, walks };
    } else {
      const db = await getDb();
      await db.collection<PropertyDoc>("properties").updateOne(
        { _id: keep.id },
        { $set: { placeKey, label: keep.label, walks } },
      );
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
  // Never reuse the seeded sample property just because someone's real address
  // happens to normalize to the same key (e.g. typing "5614 Beacon St" again) —
  // that would silently hand them fixed demo data and block them from scanning.
  const existing = (await listProperties()).find(
    (p) => !p.isSample && !isLandlordPortfolio(p) && addressKey(p) === placeKey,
  );
  if (existing) return { property: existing, reused: true };

  const cityContext = fillCityContextFromNearbyHouses(raw, await listProperties(), await lookupCityContext(raw));
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
  const existing = await loadProperty(propertyId);
  if (!existing) return null;
  return ensureWalksFor(existing);
}

async function loadProperty(propertyId: string): Promise<Property | null> {
  await ensureSeed();
  if (!hasMongo()) return mem.properties.find((p) => p.id === propertyId) ?? null;
  const db = await getDb();
  const doc = await db.collection<PropertyDoc>("properties").findOne({ _id: propertyId });
  return doc ? asProperty(doc) : null;
}

function makeWalk(kind: WalkKind, startedAt: string, createdBy?: string, createdByName?: string): Walk {
  return {
    id: id("walk"),
    kind,
    startedAt,
    createdBy,
    createdByName,
  };
}

async function ensureWalksFor(property: Property): Promise<Property> {
  if (property.isSample) return property;
  const scans = await listScans({ propertyId: property.id });
  let walks = [...(property.walks ?? [])];
  let changed = false;
  if (!walks.length && scans.length) {
    const oldest = [...scans].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0]!;
    walks = [makeWalk("move_in", oldest.capturedAt, property.createdBy, property.createdByName)];
    changed = true;
  }
  const fallback = walks[0];
  if (fallback) {
    const missing = scans.filter((s) => !s.walkId);
    if (missing.length) {
      changed = true;
      if (!hasMongo()) {
        for (const s of mem.scans) {
          if (s.propertyId === property.id && !s.walkId) s.walkId = fallback.id;
        }
      } else {
        const db = await getDb();
        await db.collection("scans").updateMany(
          { propertyId: property.id, $or: [{ walkId: { $exists: false } }, { walkId: null }, { walkId: "" }] },
          { $set: { walkId: fallback.id } },
        );
      }
    }
  }
  if (changed) {
    property.walks = walks;
    await patchProperty(property.id, { walks });
  }
  return property;
}

export async function createWalk(input: {
  propertyId: string;
  kind: WalkKind;
  createdBy?: string;
  createdByName?: string;
}): Promise<{ walk: Walk; property: Property } | { error: string }> {
  const property = await getProperty(input.propertyId);
  if (!property) return { error: "Unknown property" };
  if (property.id === SAMPLE_PROPERTY_ID) return { error: "Sample house is read-only" };
  const now = new Date().toISOString();
  let walks = [...(property.walks ?? [])];
  const openSame = walks.find((w) => !w.closedAt && w.kind === input.kind);
  if (openSame && input.kind === "move_in") {
    return { walk: openSame, property };
  }
  const walk = makeWalk(input.kind, now, input.createdBy, input.createdByName);
  if (walks.length === 0) {
    walks = [walk];
  } else {
    walks = walks.map((w) => (w.closedAt ? w : { ...w, closedAt: now }));
    walks.push(walk);
  }
  property.walks = walks;
  await patchProperty(property.id, { walks });
  return { walk, property };
}

export async function closeAllWalks(
  propertyId: string,
): Promise<{ property: Property } | { error: string }> {
  const property = await getProperty(propertyId);
  if (!property) return { error: "Unknown property" };
  if (property.id === SAMPLE_PROPERTY_ID) return { error: "Sample house is read-only" };
  const now = new Date().toISOString();
  property.walks = (property.walks ?? []).map((w) => (w.closedAt ? w : { ...w, closedAt: now }));
  await patchProperty(property.id, { walks: property.walks });
  return { property };
}

export async function refreshPropertyCity(propertyId: string): Promise<Property | null> {
  const existing = await getProperty(propertyId);
  if (!existing) return null;
  const lookedUp = await lookupCityContext(existing.label);
  const cityContext = fillCityContextFromNearbyHouses(existing.label, await listProperties(), lookedUp);
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

  // Prefer the training `frames` collection (binary) over inline scan.imageUrl.
  const fromFrames = await getTrainingFrameBytes(id);
  if (fromFrames) {
    return { kind: "bytes", contentType: fromFrames.contentType, bytes: fromFrames.bytes };
  }

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
  if (imageUrl.startsWith("/api/scans/") && imageUrl.endsWith("/image")) {
    return null;
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
  source?: "capture" | "upload";
  scannedBy?: string;
  scannedByName?: string;
  walkId?: string;
}): Promise<{ scan: Scan } | { error: string }> {
  await ensureSeed();
  const property = await getProperty(input.propertyId);
  if (!property) return { error: "Unknown property" };
  if (property.id === SAMPLE_PROPERTY_ID) {
    return { error: "Create your own property before scanning — the sample one is demo data only" };
  }

  let walkId = input.walkId;
  const walks = property.walks ?? [];
  if (walkId && !walks.some((w) => w.id === walkId)) walkId = undefined;
  if (!walkId) {
    const open = walks.find((w) => !w.closedAt) ?? walks[0];
    if (open) {
      walkId = open.id;
    } else {
      const created = await createWalk({
        propertyId: property.id,
        kind: "move_in",
        createdBy: input.scannedBy,
        createdByName: input.scannedByName,
      });
      if ("error" in created) return created;
      walkId = created.walk.id;
    }
  }

  const scanId = id("scan");
  const detected = await runDetect(input.image);
  // Never layer legal/escalation commentary onto a degraded (Gemini-failed) reading —
  // there's nothing real underneath it to escalate.
  const civic = detected.degraded
    ? { detections: detected.detections, findingExtra: undefined, escalations: [] }
    : escalateDetections(detected.detections, property?.cityContext);
  const detections = civic.detections;
  const finding = civic.findingExtra
    ? `${detected.finding} ${civic.findingExtra}`
    : detected.finding;
  const capturedAt = new Date().toISOString();
  const room = input.room.trim() || "room";
  const surface = input.surface.trim() || "surface";

  // Archive the original frame + labels in Mongo `frames` for future training.
  await saveTrainingFrame({
    scanId,
    propertyId: input.propertyId,
    room,
    surface,
    imageDataUrl: input.image,
    detections,
    finding,
    detector: detected.detector,
    capturedAt,
    source: input.source ?? "capture",
    scannedBy: input.scannedBy,
    scannedByName: input.scannedByName,
  });

  const persisted = await persistImage(input.image, scanId);
  const imageUrl = persisted.startsWith("data:") ? `/api/scans/${scanId}/image` : persisted;

  // Grok Imagine enrichment — educational still only; never blocks the scan if it fails.
  let imagineUrl: string | undefined;
  if (!detected.degraded && detected.detections.length) {
    try {
      const { imagineProgressionStill } = await import("./grok");
      const url = await imagineProgressionStill({
        finding: detected.finding,
        room,
        surface,
        classes: [...new Set(detected.detections.map((d) => d.cls.replace(/_/g, " ")))],
      });
      if (url) imagineUrl = url;
    } catch (err) {
      console.error("[scan] Grok Imagine skipped", err);
    }
  }

  const scan: Scan = {
    id: scanId,
    propertyId: input.propertyId,
    walkId,
    room,
    surface,
    imageUrl,
    capturedAt,
    detections,
    totalAffectedRatio: totalAffectedRatio(detections),
    finding,
    detector: detected.detector,
    degraded: detected.degraded,
    escalations: civic.escalations.length ? civic.escalations : undefined,
    scannedBy: input.scannedBy,
    scannedByName: input.scannedByName,
    imagineUrl,
  };

  if (!hasMongo()) {
    mem.scans.unshift({ ...scan, imageUrl: input.image });
    return { scan: { ...scan, imageUrl: clientImageUrl(scan.id, input.image) } };
  }
  const db = await getDb();
  const { id: ignoredId, ...rest } = scan;
  void ignoredId;
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
