import { buildLeadLine } from "./water";
import type {
  AreaLead,
  CityContext,
  CivicPulse,
  EbllLevel,
  HousingInspection,
  HousingServiceRequest,
  HousingViolation,
  NearbyEstimate,
} from "./types";

const CKAN = "https://data.wprdc.org/api/3/action/datastore_search";

const RESOURCES = {
  assessments: "65855e14-549e-4992-b5be-d629afc676fa",
  leadLines: "2ddfd798-b71a-4f78-bc17-8c54c6a30511",
  parcelEbll: "39e8ae7e-5dca-421e-b87d-8cec34c91950",
  zipEbll: "a9ea82c2-4486-4ac9-b830-6383931e9604",
  tractEbll: "8432f1ad-c5bf-447f-b34b-160d8ee063b6",
  hceServiceRequests: "bcdbf0d3-5a5b-4ded-afe1-74a603232214",
  hceInspections: "504190c4-d5ae-47bd-8cc7-086c49c962cc",
  hceViolations: "b5343af3-8c22-4833-96a0-0379aa7681e1",
  hceServiceRequestsHist: "6bf7c881-2164-4212-b714-8bea3f660f57",
  hceInspectionsHist: "a39e5edc-0001-404f-b4af-05534e34526f",
  hceViolationsHist: "f3df0760-54cc-4279-b7c8-a12a60f4f0f6",
  pgh311: "29462525-62a6-45bf-9b5e-ad2e1c06348d",
};

const SKIP_TOKENS = new Set(["PITTSBURGH", "PA", "PENNSYLVANIA", "USA"]);

const STREET_SUFFIX = new Set([
  "ST",
  "STREET",
  "AVE",
  "AVENUE",
  "BLVD",
  "BOULEVARD",
  "RD",
  "ROAD",
  "DR",
  "DRIVE",
  "LN",
  "LANE",
  "CT",
  "COURT",
  "WAY",
  "PL",
  "PLACE",
  "TER",
  "TERRACE",
  "CIR",
  "CIRCLE",
]);

type Rec = Record<string, unknown>;

function emptyContext(partial?: Partial<CityContext>): CityContext {
  return {
    fetchedAt: new Date().toISOString(),
    ok: true,
    matched: false,
    source: "wprdc",
    yearBuilt: null,
    leadPaintLikely: false,
    leadPaintNote: "No year-built record found for this address yet.",
    serviceRequests: [],
    inspections: [],
    violations: [],
    ...partial,
  };
}

export function parseStreetAddress(raw: string) {
  const cleaned = raw
    .toUpperCase()
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const zip = cleaned.match(/\b(15\d{3})\b/)?.[1] ?? "";
  let working = cleaned
    .replace(/\bPITTSBURGH\b.*$/i, "")
    .replace(/\bMCKEESPORT\b.*$/i, "")
    .replace(/\bWILKINSBURG\b.*$/i, "")
    .replace(/\bPA\b.*$/i, "")
    .replace(/\b15\d{3}\b/g, "")
    .trim();
  const unitMatch = working.match(/\b(?:APT|APARTMENT|UNIT|STE|SUITE|#)\s*([A-Z0-9-]+)\b/);
  const unit = unitMatch?.[1] ?? "";
  if (unitMatch) working = working.replace(unitMatch[0], " ").replace(/\s+/g, " ").trim();
  const m = working.match(/^(\d+)\s+(.+)$/);
  const house = m?.[1] ?? "";
  const street = (m?.[2] ?? working).trim();
  const tokens = streetCoreTokens(street);
  const queryToken = tokens.find((t) => t.length >= 4) ?? tokens[0] ?? house;
  return { house, street, tokens, queryToken, zip, unit, cleaned: working };
}

const STREET_ALIASES: Record<string, string> = { BACON: "BEACON" };

function canonicalStreetTokens(tokens: string[]) {
  return tokens.map((t) => STREET_ALIASES[t] ?? t);
}

/** Same building + same unit → one report. Different apt/unit stays a separate house. */
export function placeKeyFromAddress(raw: string) {
  const p = parseStreetAddress(raw);
  const street = canonicalStreetTokens(p.tokens).join(" ") || p.street.replace(/\s+/g, " ");
  const unit = p.unit || "_";
  return `${p.house}|${street}|${unit}`.toLowerCase();
}

export function streetKeyFromAddress(raw: string) {
  const p = parseStreetAddress(raw);
  return canonicalStreetTokens(p.tokens).join(" ").toLowerCase();
}

export function displayAddress(raw: string) {
  const p = parseStreetAddress(raw);
  const street = (p.street || raw.trim()).replace(/\bBACON\b/gi, "Beacon");
  const base = [p.house, street].filter(Boolean).join(" ") || raw.trim();
  return p.unit ? `${base} · Apt ${p.unit}` : base;
}

function streetCoreTokens(street: string) {
  const parts = street
    .toUpperCase()
    .replace(/[.#,]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const core: string[] = [];
  for (const t of parts) {
    if (SKIP_TOKENS.has(t)) continue;
    core.push(t);
    if (STREET_SUFFIX.has(t) && core.some((c) => !STREET_SUFFIX.has(c))) break;
  }
  return core.filter((t) => !STREET_SUFFIX.has(t) && t.length >= 3);
}

function asText(v: unknown) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ebllLevel(pct: number | null): EbllLevel {
  if (pct == null) return "unknown";
  if (pct >= 15) return "elevated";
  if (pct >= 5) return "watch";
  return "low";
}

function pickLevel(a: EbllLevel, b: EbllLevel): EbllLevel {
  const rank: Record<EbllLevel, number> = { unknown: 0, low: 1, watch: 2, elevated: 3 };
  return rank[a] >= rank[b] ? a : b;
}

function areaLeadSummary(input: {
  zipCode?: string;
  zipPercent: number | null;
  tractPercent: number | null;
  level: EbllLevel;
}): string {
  if (input.level === "unknown") {
    return "Not enough published blood-lead data for this PIN / ZIP yet (small counts are censored).";
  }
  const zipBit =
    input.zipPercent != null && input.zipCode
      ? `${input.zipPercent.toFixed(1)}% of tested children in ZIP ${input.zipCode}`
      : null;
  const tractBit =
    input.tractPercent != null ? `${input.tractPercent.toFixed(1)}% in this census tract` : null;
  const where = [zipBit, tractBit].filter(Boolean).join(", and ");
  if (input.level === "elevated") {
    return `${where} had elevated blood lead (ACHD, among children who were tested). That is a neighborhood health signal — not a label on the people next door.`;
  }
  if (input.level === "watch") {
    return `${where} showed a moderate elevated-blood-lead rate among tested children. Worth extra care with peeling paint and dust.`;
  }
  return `${where} is on the lower side among published Allegheny County rates. Still use lead-safe cleaning in older homes.`;
}

function recordStreet(rec: Rec) {
  return asText(rec.address || rec.street || rec.STREET).toUpperCase();
}

function addressMatches(rec: Rec, house: string, tokens: string[]) {
  const street = recordStreet(rec);
  if (!street) return false;
  if (house && !street.includes(house)) return false;
  const have = street
    .replace(/[.#,]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const need = tokens.filter((t) => t.length >= 3);
  if (!need.length) return Boolean(house) && street.includes(house);
  return need.every((t) => have.includes(t));
}

function streetQuery(parsed: ReturnType<typeof parseStreetAddress>) {
  const street = parsed.street.replace(/\bBACON\b/g, "BEACON");
  return [parsed.house, street].filter(Boolean).join(" ").trim();
}

async function probeStreetParcels(parsed: ReturnType<typeof parseStreetAddress>): Promise<Rec[]> {
  const target = Number(parsed.house);
  const street = parsed.street.replace(/\bBACON\b/g, "BEACON");
  if (!Number.isFinite(target) || !street) return [];
  const offsets = [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 1, -1];
  const nums = [...new Set(offsets.map((o) => target + o).filter((n) => n > 0))].slice(0, 12);
  const batches = await Promise.all(
    nums.map((n) =>
      datastoreSearch({
        resource_id: RESOURCES.assessments,
        q: `${n} ${street}`,
        limit: 4,
      }),
    ),
  );
  return batches.flat();
}

async function datastoreSearch(input: {
  resource_id: string;
  q?: string;
  filters?: Rec;
  limit?: number;
  timeoutMs?: number;
}): Promise<Rec[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs ?? 9000);
  try {
    const res = await fetch(CKAN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_id: input.resource_id,
        q: input.q,
        filters: input.filters,
        limit: input.limit ?? 50,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { success?: boolean; result?: { records?: Rec[] } };
    if (!data.success) return [];
    return data.result?.records ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function uniqBy<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = key(row);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

const WATER_311 = /water|flood|sewer|basement|pipe|main.?break|inlet|hydrant/i;

function streetTokenMatch(street: string, tokens: string[]) {
  const have = street
    .toUpperCase()
    .replace(/[.#,]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const need = tokens.filter((t) => t.length >= 3);
  if (!need.length) return false;
  return need.every((t) => have.includes(t) || street.toUpperCase().includes(t));
}

function civicPulse(rows: Rec[], tokens: string[]): CivicPulse {
  const matched = rows.filter((row) => {
    const street = asText(row.street || row.address);
    return streetTokenMatch(street, tokens);
  });
  const pool = matched;
  const water = pool.filter((row) => WATER_311.test(asText(row.request_type_name || row.request_type)));
  const recent = water.slice(0, 6).map((row) => ({
    type: asText(row.request_type_name || row.request_type) || "311",
    street: asText(row.street),
    at: asText(row.create_date_utc || row.create_date_local),
    neighborhood: asText(row.neighborhood) || undefined,
  }));
  const monthlyMap = new Map<string, number>();
  for (const row of pool) {
    const at = asText(row.create_date_utc || row.create_date_local);
    const month = at.slice(0, 7);
    if (month.length !== 7) continue;
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
  }
  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([month, count]) => ({ month, count }));
  const waterNearby = water.length > 0;
  return {
    waterNearby,
    prompt: waterNearby
      ? "Water line activity reported nearby — scan under-sink pipes and basement walls today."
      : undefined,
    recent,
    monthly,
  };
}

function leadNote(yearBuilt: number | null, leadLine?: Rec | null, nearby?: NearbyEstimate) {
  const bits: string[] = [];
  if (nearby?.used && yearBuilt) {
    bits.push(nearby.note);
  } else if (yearBuilt && yearBuilt > 0 && yearBuilt < 1978) {
    bits.push(
      `Built ${yearBuilt}. HUD treats pre-1978 housing as likely to contain lead-based paint unless it has been certified otherwise.`,
    );
  } else if (yearBuilt && yearBuilt >= 1978) {
    bits.push(`Built ${yearBuilt}, after the federal lead-paint ban.`);
  }
  const pub = asText(leadLine?.public_status);
  const priv = asText(leadLine?.private_status);
  if (pub || priv) {
    bits.push(`Water authority lead-line status — public: ${pub || "unknown"}, private: ${priv || "unknown"}.`);
  }
  if (!bits.length) return "No parcel year-built or lead-line record matched this address.";
  return bits.join(" ");
}

function isExactParcel(row: Rec, house: string, tokens: string[]) {
  const num = asText(row.PROPERTYHOUSENUM);
  if (house && num !== house) return false;
  const st = asText(row.PROPERTYADDRESS).toUpperCase();
  const need = tokens.filter((t) => t.length >= 3);
  if (!need.length) return Boolean(house) && num === house;
  return need.every((t) => st.includes(t));
}

function nearbyParcels(rows: Rec[], house: string, tokens: string[]) {
  const target = Number(house);
  if (!Number.isFinite(target)) return [];
  return rows
    .map((row) => {
      const n = Number(asText(row.PROPERTYHOUSENUM));
      const year = asNum(row.YEARBLT);
      const dist = Number.isFinite(n) ? Math.abs(n - target) : 9999;
      const sameSide = Number.isFinite(n) && n % 2 === target % 2;
      return { row, n, year, dist, sameSide };
    })
    .filter((item) => {
      if (item.dist === 0 || item.dist > 80) return false;
      const st = asText(item.row.PROPERTYADDRESS).toUpperCase();
      const need = tokens.filter((t) => t.length >= 3);
      return need.length ? need.every((t) => st.includes(t)) : true;
    })
    .sort((a, b) => {
      if (a.sameSide !== b.sameSide) return a.sameSide ? -1 : 1;
      return a.dist - b.dist;
    })
    .slice(0, 8);
}

function medianYear(years: number[]) {
  const s = [...years].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? null;
}

function recHouseNumber(rec: Rec): number | null {
  const fromField = Number(asText(rec.PROPERTYHOUSENUM || rec.house_number));
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const street = recordStreet(rec);
  const m = street.match(/\b(\d{1,6})\b/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

function nearbyEstimateFromParcels(
  neighbors: ReturnType<typeof nearbyParcels>,
  tokens: string[],
): NearbyEstimate | undefined {
  const years = neighbors
    .map((n) => n.year)
    .filter((y): y is number => y != null && y > 1800 && y < 2030);
  if (!neighbors.length && !years.length) return undefined;
  const zips = neighbors
    .map((n) => asText(n.row.PROPERTYZIP).replace(/\D/g, "").slice(0, 5))
    .filter((z) => z.length === 5);
  const zipCode = zips.sort((a, b) => zips.filter((z) => z === b).length - zips.filter((z) => z === a).length)[0];
  const yearBuilt = years.length ? medianYear(years) : null;
  const street = tokens.join(" ").toLowerCase() || "this street";
  const nearestHouses = neighbors
    .slice(0, 4)
    .map((n) => `${n.n} ${asText(n.row.PROPERTYADDRESS)}`.trim())
    .filter(Boolean);
  const minY = years.length ? Math.min(...years) : undefined;
  const maxY = years.length ? Math.max(...years) : undefined;
  const yearBit =
    yearBuilt != null
      ? `Typical year built ${yearBuilt}${minY != null && maxY != null && minY !== maxY ? ` (range ${minY}–${maxY})` : ""}`
      : "Year built still mixed";
  return {
    used: true,
    sampleSize: neighbors.length,
    street,
    nearestHouses,
    yearBuilt,
    yearBuiltMin: minY,
    yearBuiltMax: maxY,
    zipCode,
    note: `No PIN matched this exact house number. Used ${neighbors.length} nearby parcel${neighbors.length === 1 ? "" : "s"} on ${street} (${yearBit}). Block estimate — not a year-built for this PIN.`,
  };
}

function guessZip(address: string, parsed: ReturnType<typeof parseStreetAddress>) {
  if (parsed.zip) return parsed.zip;
  const u = address.toUpperCase();
  if (u.includes("MCKEESPORT")) return "15132";
  if (/\bBEACON\b/.test(parsed.street)) return "15217";
  return undefined;
}

export function fillCityContextFromNearbyHouses(
  address: string,
  others: { label: string; cityContext?: CityContext }[],
  ctx: CityContext,
): CityContext {
  if (ctx.yearBuilt && ctx.areaLead && ctx.areaLead.level !== "unknown") return ctx;
  const key = streetKeyFromAddress(address);
  const house = Number(parseStreetAddress(address).house);
  const scored = others
    .map((row) => {
      const other = row.cityContext;
      if (!other || streetKeyFromAddress(row.label) !== key) return null;
      if (!other.yearBuilt && !other.zipCode && other.areaLead?.level === "unknown") return null;
      const n = Number(parseStreetAddress(row.label).house);
      const dist = Number.isFinite(house) && Number.isFinite(n) ? Math.abs(n - house) : 999;
      if (dist === 0 || dist > 80) return null;
      return { label: row.label, other, dist };
    })
    .filter((row): row is { label: string; other: CityContext; dist: number } => Boolean(row))
    .sort((a, b) => a.dist - b.dist);
  if (!scored.length) return ctx;
  const years = scored.map((s) => s.other.yearBuilt).filter((y): y is number => Boolean(y && y > 1800));
  const mid = years.length ? years.sort((a, b) => a - b)[Math.floor((years.length - 1) / 2)] : null;
  const yearBuilt = ctx.yearBuilt ?? mid ?? null;
  const zipCode = ctx.zipCode ?? scored.find((s) => s.other.zipCode)?.other.zipCode;
  const areaLead =
    ctx.areaLead?.level !== "unknown" && ctx.areaLead
      ? ctx.areaLead
      : (scored.find((s) => s.other.areaLead && s.other.areaLead.level !== "unknown")?.other.areaLead ?? ctx.areaLead);
  const civic = ctx.civic?.waterNearby ? ctx.civic : (scored.find((s) => s.other.civic)?.other.civic ?? ctx.civic);
  const sample = scored.slice(0, 4).map((s) => s.label);
  const nearby: NearbyEstimate = {
    used: true,
    sampleSize: scored.length,
    street: key || "this street",
    nearestHouses: sample,
    yearBuilt,
    zipCode,
    note: `No PIN matched this exact house number. Estimated from ${scored.length} nearby house${scored.length === 1 ? "" : "s"} already on file (${sample.join(", ")}). Block estimate — not this PIN’s assessment.`,
  };
  const year = yearBuilt && yearBuilt > 0 ? yearBuilt : ctx.yearBuilt ?? null;
  return {
    ...ctx,
    zipCode: zipCode ?? ctx.zipCode,
    yearBuilt: year,
    leadPaintLikely: Boolean(year && year < 1978) || ctx.leadPaintLikely,
    leadPaintNote: nearby.note,
    areaLead: areaLead ?? ctx.areaLead,
    civic,
    nearby,
  };
}

export async function lookupCityContext(address: string): Promise<CityContext> {
  const parsed = parseStreetAddress(address);
  const matchTokens = parsed.tokens.map((t) => (t === "BACON" ? "BEACON" : t));
  if (!parsed.house && !parsed.queryToken) {
    return emptyContext({ ok: true, error: "Need a street number to match county records." });
  }

  try {
    const query = parsed.queryToken || parsed.house;
    const [assessments, probedParcels, srNow, inspNow, srHist, threeOneOne] = await Promise.all([
      datastoreSearch({
        resource_id: RESOURCES.assessments,
        q: streetQuery(parsed),
        limit: 8,
      }),
      probeStreetParcels(parsed),
      datastoreSearch({ resource_id: RESOURCES.hceServiceRequests, q: query, limit: 80 }),
      datastoreSearch({ resource_id: RESOURCES.hceInspections, q: query, limit: 80 }),
      datastoreSearch({ resource_id: RESOURCES.hceServiceRequestsHist, q: query, limit: 80 }),
      datastoreSearch({
        resource_id: RESOURCES.pgh311,
        q: parsed.queryToken || parsed.street,
        limit: 24,
        timeoutMs: 6000,
      }),
    ]);

    const assessmentPool = uniqBy(
      [...assessments, ...probedParcels],
      (row) => asText(row.PARID) || `${asText(row.PROPERTYHOUSENUM)}|${asText(row.PROPERTYADDRESS)}`,
    );
    const assessment = assessmentPool.find((row) => isExactParcel(row, parsed.house, matchTokens));
    const neighbors = nearbyParcels(assessmentPool, parsed.house, matchTokens);
    const yearBuiltRaw = assessment?.YEARBLT;
    const exactYear =
      typeof yearBuiltRaw === "number"
        ? yearBuiltRaw
        : yearBuiltRaw
          ? Number(yearBuiltRaw)
          : null;
    const nearby =
      !assessment || !(Number.isFinite(exactYear) && exactYear && exactYear > 0)
        ? nearbyEstimateFromParcels(neighbors, matchTokens)
        : undefined;
    if (assessment && nearby) {
      nearby.note = `This PIN has no year-built on file. ${nearby.sampleSize} nearby parcel${nearby.sampleSize === 1 ? "" : "s"} on ${nearby.street} typically date to ${nearby.yearBuilt ?? "an unknown year"}. Block estimate — not a certified year for this house.`;
    }

    const yearBuilt = (Number.isFinite(exactYear) && exactYear && exactYear > 0 ? exactYear : null) ?? nearby?.yearBuilt ?? null;
    const parcelId = asText(assessment?.PARID) || undefined;
    const zipCode =
      asText(assessment?.PROPERTYZIP).replace(/\D/g, "").slice(0, 5) ||
      nearby?.zipCode ||
      parsed.zip ||
      guessZip(address, parsed) ||
      undefined;

    const [leadRows, parcelEbllRows, zipEbllRows] = await Promise.all([
      parcelId
        ? datastoreSearch({
            resource_id: RESOURCES.leadLines,
            filters: { parcel_id: parcelId },
            limit: 3,
          })
        : Promise.resolve([]),
      parcelId
        ? datastoreSearch({
            resource_id: RESOURCES.parcelEbll,
            filters: { parcel_id: parcelId },
            limit: 3,
          })
        : Promise.resolve([]),
      zipCode
        ? datastoreSearch({
            resource_id: RESOURCES.zipEbll,
            q: zipCode,
            limit: 8,
          })
        : Promise.resolve([]),
    ]);

    const targetHouse = Number(parsed.house);
    const onThisHouse = (row: Rec) => addressMatches(row, parsed.house, matchTokens);
    const onThisBlock = (row: Rec) => {
      if (!streetTokenMatch(recordStreet(row), matchTokens)) return false;
      if (!Number.isFinite(targetHouse)) return false;
      const n = recHouseNumber(row);
      if (n == null) return streetTokenMatch(recordStreet(row), matchTokens);
      const dist = Math.abs(n - targetHouse);
      return dist > 0 && dist <= 80;
    };

    const matchedSr = [...srNow, ...srHist].filter(onThisHouse);
    const nearbySr = [...srNow, ...srHist].filter(onThisBlock);
    const matchedInsp = inspNow.filter(onThisHouse);
    const nearbyInspRows = inspNow.filter(onThisBlock);

    const histIds = matchedSr
      .map((row) => asText(row.INSPECT_ID))
      .filter(Boolean)
      .slice(0, 8);

    const histInspections = histIds.length
      ? (
          await Promise.all(
            histIds.map((id) =>
              datastoreSearch({
                resource_id: RESOURCES.hceInspectionsHist,
                filters: { INSPECT_ID: id },
                limit: 5,
              }),
            ),
          )
        ).flat()
      : [];

    const inspectionIds = uniqBy(
      [
        ...matchedInsp.map((row) => asText(row.inspection_id)),
        ...histInspections.map((row) => asText(row.INSPECT_ID)),
      ].filter(Boolean),
      (id) => id,
    ).slice(0, 10);

    const violationBatches = await Promise.all(
      inspectionIds.flatMap((id) => [
        datastoreSearch({
          resource_id: RESOURCES.hceViolations,
          filters: { inspection_id: id },
          limit: 20,
        }),
        datastoreSearch({
          resource_id: RESOURCES.hceViolationsHist,
          filters: { INSPECT_ID: id },
          limit: 20,
        }),
      ]),
    );
    const violationRows = violationBatches.flat();

    const serviceRequests: HousingServiceRequest[] = uniqBy(
      matchedSr.map((row) => ({
        number: asText(row.service_request_number || row.SR_NUM),
        date: asText(row.request_date) || undefined,
        address: recordStreet(row),
        city: asText(row.city || row.CITY) || undefined,
        requestType: asText(row.request_type || row.REQUEST_TYPE) || undefined,
        propertyType: asText(row.property_type || row.PROPERTY_TYPE) || undefined,
      })),
      (row) => row.number || row.address,
    ).slice(0, 12);

    const nearbyServiceRequests: HousingServiceRequest[] = uniqBy(
      nearbySr.map((row) => ({
        number: asText(row.service_request_number || row.SR_NUM),
        date: asText(row.request_date) || undefined,
        address: recordStreet(row),
        city: asText(row.city || row.CITY) || undefined,
        requestType: asText(row.request_type || row.REQUEST_TYPE) || undefined,
        propertyType: asText(row.property_type || row.PROPERTY_TYPE) || undefined,
      })),
      (row) => row.number || row.address,
    ).slice(0, 8);

    const inspections: HousingInspection[] = uniqBy(
      [
        ...matchedInsp.map((row) => ({
          inspectionId: asText(row.inspection_id),
          serviceRequest: asText(row.service_request_number) || undefined,
          date: asText(row.inspection_date) || undefined,
          type: asText(row.inspection_type) || undefined,
          address: recordStreet(row),
          city: asText(row.city) || undefined,
          requestType: asText(row.request_type) || undefined,
        })),
        ...histInspections.map((row) => ({
          inspectionId: asText(row.INSPECT_ID),
          serviceRequest: asText(row.SR_NUM) || undefined,
          date: asText(row.BEG_DATE) || undefined,
          type: asText(row.STATUS) || undefined,
          address: recordStreet(matchedSr.find((s) => asText(s.INSPECT_ID) === asText(row.INSPECT_ID)) ?? {}),
        })),
      ].filter((row) => row.inspectionId || row.address),
      (row) => row.inspectionId || `${row.date}-${row.address}`,
    ).slice(0, 12);

    const nearbyInspections: HousingInspection[] = uniqBy(
      nearbyInspRows.map((row) => ({
        inspectionId: asText(row.inspection_id),
        serviceRequest: asText(row.service_request_number) || undefined,
        date: asText(row.inspection_date) || undefined,
        type: asText(row.inspection_type) || undefined,
        address: recordStreet(row),
        city: asText(row.city) || undefined,
        requestType: asText(row.request_type) || undefined,
      })),
      (row) => row.inspectionId || `${row.date}-${row.address}`,
    ).slice(0, 8);

    const violations: HousingViolation[] = uniqBy(
      violationRows.map((row) => ({
        inspectionId: asText(row.inspection_id || row.INSPECT_ID),
        serviceRequest: asText(row.service_request_number || row.SR_NUM) || undefined,
        violation: asText(row.violation || row.VIOLATION) || "Cited condition",
        description: asText(row.description || row.REMEDY) || undefined,
        status: asText(row.status || row.VIOL_CLASS) || undefined,
        date: asText(row.completed_date) || undefined,
      })),
      (row) => `${row.inspectionId}:${row.violation}:${row.date}`,
    ).slice(0, 20);

    const matched = Boolean(
      assessment || serviceRequests.length || inspections.length || violations.length,
    );
    const year = Number.isFinite(yearBuilt) ? yearBuilt : null;
    const leadPaintLikely = Boolean(year && year > 0 && year < 1978);
    const leadLine = buildLeadLine(leadRows[0], zipCode);
    const leadServiceLine = leadLine.isLead;
    const civic = civicPulse(threeOneOne, matchTokens);

    const zipRow = zipEbllRows.find((row) => asText(row["Zip Code"]).slice(0, 5) === zipCode);
    const parcelEbll = parcelEbllRows[0];
    const tractId = asText(parcelEbll?.census_tract) || undefined;
    const tractRows = tractId
      ? await datastoreSearch({ resource_id: RESOURCES.tractEbll, q: tractId, limit: 6 })
      : [];
    const tractRow =
      tractRows.find(
        (row) => asText(row.CensusTract).replace(/\D/g, "") === (tractId ?? "").replace(/\D/g, ""),
      ) ?? tractRows[0];

    const zipPercent = asNum(zipRow?.percentEBLL2021_2024);
    const tractPercent =
      asNum(tractRow?.percentEBLL2021_2024) ?? asNum(parcelEbll?.census_tract_ebll_15_20);
    const zipLevel = ebllLevel(zipPercent);
    const tractLevel = ebllLevel(tractPercent);
    const level = pickLevel(zipLevel, tractLevel);
    const areaLead: AreaLead = {
      pin: parcelId,
      zipCode,
      censusTract: tractId,
      zipPercent,
      zipNote: asText(zipRow?.note2021_2024) || undefined,
      tractPercent,
      tractNote: asText(tractRow?.note2021_2024 || parcelEbll?.note15_20) || undefined,
      level,
      summary: areaLeadSummary({ zipCode, zipPercent, tractPercent, level }),
    };

    const neighborhood =
      asText(assessment?.NEIGHDESC || assessment?.PROPERTYCITY) ||
      asText(neighbors[0]?.row.NEIGHDESC || neighbors[0]?.row.PROPERTYCITY) ||
      undefined;

    return emptyContext({
      ok: true,
      matched,
      parcelId,
      zipCode,
      yearBuilt: year && year > 0 ? year : null,
      neighborhood,
      leadPaintLikely,
      leadServiceLine,
      leadLine,
      leadPaintNote: leadNote(year && year > 0 ? year : null, leadRows[0], nearby),
      areaLead,
      civic,
      nearby,
      serviceRequests,
      inspections,
      violations,
      nearbyServiceRequests: nearbyServiceRequests.length ? nearbyServiceRequests : undefined,
      nearbyInspections: nearbyInspections.length ? nearbyInspections : undefined,
    });
  } catch (err) {
    return emptyContext({
      ok: false,
      zipCode: parsed.zip || undefined,
      leadLine: buildLeadLine(undefined, parsed.zip || undefined),
      error: err instanceof Error ? err.message : "County records unavailable",
      leadPaintNote: "Could not reach WPRDC. Move-in photos still work.",
    });
  }
}
