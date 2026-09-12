import { LANDLORD_CREATED_BY } from "./persona";
import { placeKeyFromAddress } from "./pgh";
import type { CityContext, Detection, DefectClass, Property, Scan, Walk } from "./types";

type SeedHouse = {
  id: string;
  label: string;
  neighborhood: "Shadyside" | "Squirrel Hill" | "Oakland";
  zip: string;
  yearBuilt: number;
};

const HOUSES: SeedHouse[] = [
  { id: "prop_ll_walnut_5738", label: "5738 Walnut St, Pittsburgh PA 15232", neighborhood: "Shadyside", zip: "15232", yearBuilt: 1912 },
  { id: "prop_ll_ellsworth_5831", label: "5831 Ellsworth Ave, Pittsburgh PA 15232", neighborhood: "Shadyside", zip: "15232", yearBuilt: 1908 },
  { id: "prop_ll_aiken_317", label: "317 S Aiken Ave, Pittsburgh PA 15232", neighborhood: "Shadyside", zip: "15232", yearBuilt: 1924 },
  { id: "prop_ll_walnut_5534", label: "5534 Walnut St, Pittsburgh PA 15232", neighborhood: "Shadyside", zip: "15232", yearBuilt: 1916 },
  { id: "prop_ll_murray_1739", label: "1739 Murray Ave, Pittsburgh PA 15217", neighborhood: "Squirrel Hill", zip: "15217", yearBuilt: 1930 },
  { id: "prop_ll_wightman_2200", label: "2200 Wightman St, Pittsburgh PA 15217", neighborhood: "Squirrel Hill", zip: "15217", yearBuilt: 1922 },
  { id: "prop_ll_forbes_5815", label: "5815 Forbes Ave, Pittsburgh PA 15217", neighborhood: "Squirrel Hill", zip: "15217", yearBuilt: 1918 },
  { id: "prop_ll_forward_5840", label: "5840 Forward Ave, Pittsburgh PA 15217", neighborhood: "Squirrel Hill", zip: "15217", yearBuilt: 1928 },
  { id: "prop_ll_fifth_3619", label: "3619 Fifth Ave, Pittsburgh PA 15213", neighborhood: "Oakland", zip: "15213", yearBuilt: 1905 },
  { id: "prop_ll_atwood_230", label: "230 Atwood St, Pittsburgh PA 15213", neighborhood: "Oakland", zip: "15213", yearBuilt: 1910 },
];

const SURFACES: { room: string; surface: string; cls: DefectClass; finding: string }[] = [
  { room: "bathroom", surface: "ceiling_vent", cls: "mold", finding: "Discoloration around the bathroom vent — moisture tracking into the plaster." },
  { room: "bathroom", surface: "under_sink", cls: "water_seepage", finding: "Soft staining under the bath sink, consistent with a slow supply leak." },
  { room: "kitchen", surface: "under_sink", cls: "water_seepage", finding: "Cabinet back panel is dark where the trap sits." },
  { room: "kitchen", surface: "backsplash", cls: "peeling_paint", finding: "Paint lifting along the kitchen backsplash above the stove." },
  { room: "living", surface: "window_frame", cls: "peeling_paint", finding: "Window sash paint is chalking and flaking on the interior stop." },
  { room: "living", surface: "behind_furniture", cls: "mold", finding: "Spotting on the wall behind where a sofa would sit — poor air movement." },
  { room: "bedroom", surface: "closet_corner", cls: "mold", finding: "Corner of the closet shows a faint bloom on the baseboard." },
  { room: "basement", surface: "wall", cls: "water_seepage", finding: "Basement wall has a tide line and mineral staining." },
  { room: "exterior", surface: "wall", cls: "peeling_paint", finding: "Exterior paint failure on the street-facing wall." },
  { room: "any", surface: "ceiling", cls: "crack", finding: "Hairline crack across the ceiling, wider near the light box." },
];

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pick<T>(rand: () => number, list: T[], n: number) {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  }
  return out;
}

function weeksAgo(weeks: number) {
  return new Date(Date.now() - weeks * 7 * 24 * 3_600_000).toISOString();
}

function stubCity(house: SeedHouse): CityContext {
  return {
    fetchedAt: new Date().toISOString(),
    ok: true,
    matched: true,
    source: "wprdc",
    zipCode: house.zip,
    yearBuilt: house.yearBuilt,
    neighborhood: house.neighborhood,
    leadPaintLikely: house.yearBuilt < 1978,
    leadPaintNote:
      house.yearBuilt < 1978
        ? `Built ${house.yearBuilt} in ${house.neighborhood} — lead paint era. Confirm peeling interior paint.`
        : `Built ${house.yearBuilt} in ${house.neighborhood}.`,
    serviceRequests: [],
    inspections: [],
    violations: [],
  };
}

/** Stylized still of a wall/ceiling so the report has a frame, not a blank card. */
export function syntheticSurfaceImage(seedKey: string, cls: DefectClass, bbox: [number, number, number, number]) {
  const rand = mulberry(hashStr(seedKey));
  const walls = ["#cfc3b0", "#d7cdc0", "#c5c9c4", "#e2d6c4", "#bbb7ae"];
  const wall = walls[Math.floor(rand() * walls.length)]!;
  const stain =
    cls === "mold" ? "#4d5a3a" : cls === "water_seepage" ? "#8a6d55" : cls === "peeling_paint" ? "#efe6d6" : "#9a8f86";
  const stain2 = cls === "mold" ? "#2f3a24" : "#6e5344";
  const [x, y, w, h] = bbox;
  const cx = ((x + w / 2) * 640).toFixed(1);
  const cy = ((y + h / 2) * 480).toFixed(1);
  const rx = ((w * 640) / 2 + 12).toFixed(1);
  const ry = ((h * 480) / 2 + 10).toFixed(1);
  const grain = Array.from({ length: 18 }, (_, i) => {
    const gx = (rand() * 640).toFixed(1);
    const gy = (rand() * 480).toFixed(1);
    const a = (0.04 + rand() * 0.08).toFixed(2);
    return `<circle cx="${gx}" cy="${gy}" r="${(4 + rand() * 18).toFixed(1)}" fill="#000" fill-opacity="${a}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect fill="${wall}" width="640" height="480"/>
    <rect fill="#000" fill-opacity="0.05" x="0" y="0" width="640" height="36"/>
    <rect fill="#000" fill-opacity="0.04" x="0" y="444" width="640" height="36"/>
    ${grain}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${stain}" fill-opacity="0.55"/>
    <ellipse cx="${(Number(cx) + 18).toFixed(1)}" cy="${(Number(cy) - 10).toFixed(1)}" rx="${(Number(rx) * 0.45).toFixed(1)}" ry="${(Number(ry) * 0.4).toFixed(1)}" fill="${stain2}" fill-opacity="0.5"/>
  </svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function detections(cls: DefectClass, rand: () => number, spread: number): { dets: Detection[]; bbox: [number, number, number, number]; ratio: number } {
  const bbox: [number, number, number, number] = [
    0.18 + rand() * 0.28,
    0.14 + rand() * 0.22,
    0.16 + rand() * 0.2,
    0.12 + rand() * 0.16,
  ];
  const areaRatio = Number((bbox[2] * bbox[3] * (0.7 + spread)).toFixed(3));
  const dets: Detection[] = [
    {
      cls,
      confidence: Number((0.52 + rand() * 0.38).toFixed(2)),
      bbox,
      areaRatio,
    },
  ];
  if (rand() > 0.55) {
    dets.push({
      cls: rand() > 0.5 ? "peeling_paint" : cls,
      confidence: Number((0.48 + rand() * 0.3).toFixed(2)),
      bbox: [bbox[0] + 0.12, bbox[1] + 0.08, bbox[2] * 0.6, bbox[3] * 0.55],
      areaRatio: Number((areaRatio * 0.4).toFixed(3)),
    });
  }
  const ratio = dets.reduce((s, d) => s + d.areaRatio, 0);
  return { dets, bbox, ratio: Number(ratio.toFixed(3)) };
}

export type LandlordSeed = { property: Property; scans: Scan[] };

export function landlordPortfolioSeed(): LandlordSeed[] {
  return HOUSES.map((house, houseIndex) => {
    const rand = mulberry(hashStr(house.id));
    const walkId = `walk_${house.id}_movein`;
    const startedAt = weeksAgo(8 + houseIndex);
    const walk: Walk = {
      id: walkId,
      kind: "move_in",
      startedAt,
      createdBy: LANDLORD_CREATED_BY,
      createdByName: "Portfolio",
    };
    const property: Property = {
      id: house.id,
      label: house.label,
      kind: "lease",
      createdAt: startedAt,
      createdBy: LANDLORD_CREATED_BY,
      createdByName: "Portfolio",
      landlordPortfolio: true,
      placeKey: placeKeyFromAddress(house.label),
      cityContext: stubCity(house),
      walks: [walk],
    };
    const n = 4 + Math.floor(rand() * 3);
    const chosen = pick(rand, SURFACES, n);
    const scans: Scan[] = [];
    chosen.forEach((spec, i) => {
      const pass = detections(spec.cls, rand, 0.2);
      const earlyId = `scan_${house.id}_${i}_a`;
      scans.push({
        id: earlyId,
        propertyId: house.id,
        walkId,
        room: spec.room,
        surface: spec.surface,
        imageUrl: syntheticSurfaceImage(earlyId, spec.cls, pass.bbox),
        capturedAt: weeksAgo(7 + houseIndex - i * 0.15),
        detections: pass.dets,
        totalAffectedRatio: pass.ratio,
        finding: spec.finding,
        detector: "mock",
        scannedBy: LANDLORD_CREATED_BY,
        scannedByName: "Portfolio",
      });
      if (rand() > 0.35) {
        const later = detections(spec.cls, rand, 0.55);
        const lateId = `scan_${house.id}_${i}_b`;
        scans.push({
          id: lateId,
          propertyId: house.id,
          walkId,
          room: spec.room,
          surface: spec.surface,
          imageUrl: syntheticSurfaceImage(lateId, spec.cls, later.bbox),
          capturedAt: weeksAgo(1 + rand() * 2),
          detections: later.dets,
          totalAffectedRatio: Math.max(pass.ratio, later.ratio),
          finding: spec.finding.replace("faint", "clear").replace("Spotting", "Heavier spotting"),
          detector: "mock",
          scannedBy: LANDLORD_CREATED_BY,
          scannedByName: "Portfolio",
        });
      }
    });
    return { property, scans };
  });
}
