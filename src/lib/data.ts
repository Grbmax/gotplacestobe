import type { CampusRoute, LatLng, Quest, ScoredQuest, Session, Urgency, Zone, ZoneId } from "./types";

/** Meter offsets from the live GPS origin — not tied to any campus. */
const ZONE_LAYOUT: Array<{
  id: ZoneId;
  name: string;
  short: string;
  x: number;
  y: number;
  north: number;
  east: number;
}> = [
  { id: "plaza", name: "Neighborhood Plaza", short: "Plaza", x: 50, y: 50, north: 0, east: 0 },
  { id: "cafe", name: "Corner Café", short: "Café", x: 72, y: 38, north: 60, east: 180 },
  { id: "library", name: "Public Library", short: "Library", x: 22, y: 28, north: 140, east: -200 },
  { id: "park", name: "City Park", short: "Park", x: 58, y: 72, north: -180, east: 90 },
  { id: "gym", name: "Local Gym", short: "Gym", x: 28, y: 68, north: -120, east: -160 },
];

const MINUTES: Record<ZoneId, Record<ZoneId, number>> = {
  plaza: { plaza: 0, cafe: 3, library: 5, park: 4, gym: 4 },
  cafe: { plaza: 3, cafe: 0, library: 7, park: 5, gym: 6 },
  library: { plaza: 5, cafe: 7, library: 0, park: 8, gym: 6 },
  park: { plaza: 4, cafe: 5, park: 0, gym: 5, library: 8 },
  gym: { plaza: 4, cafe: 6, gym: 0, park: 5, library: 6 },
};

const URGENCY_SCORE: Record<Urgency, number> = {
  low: 0,
  medium: 0.5,
  urgent: 1,
};

function offsetLatLng(origin: LatLng, northM: number, eastM: number): LatLng {
  const dLat = northM / 111_320;
  const dLng = eastM / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

function buildZones(origin: LatLng): Zone[] {
  return ZONE_LAYOUT.map((z) => {
    const p = offsetLatLng(origin, z.north, z.east);
    return {
      id: z.id,
      name: z.name,
      short: z.short,
      x: z.x,
      y: z.y,
      lat: p.lat,
      lng: p.lng,
    };
  });
}

type QuestSeed = {
  id: string;
  requesterId: string;
  requesterName: string;
  title: string;
  detail: string;
  zone: ZoneId;
  north: number;
  east: number;
  urgency: Urgency;
  baseKarma: number;
  bonusKarma: number;
  createdAt: string;
  ageMs: number;
};

const QUEST_SEEDS: QuestSeed[] = [
  {
    id: "q1",
    requesterId: "seed-maya",
    requesterName: "Maya",
    title: "Grab my charger from the library desk",
    detail: "Black Anker brick by the west windows. Text when you have it.",
    zone: "library",
    north: 12,
    east: -18,
    urgency: "urgent",
    baseKarma: 20,
    bonusKarma: 10,
    createdAt: "2 min ago",
    ageMs: 120_000,
  },
  {
    id: "q2",
    requesterId: "seed-jules",
    requesterName: "Jules",
    title: "Hold my table at the café while I print",
    detail: "Corner seat by the window. Need ~8 minutes so we don’t lose it.",
    zone: "cafe",
    north: -8,
    east: 14,
    urgency: "medium",
    baseKarma: 20,
    bonusKarma: 5,
    createdAt: "4 min ago",
    ageMs: 240_000,
  },
  {
    id: "q3",
    requesterId: "seed-priya",
    requesterName: "Priya",
    title: "Walk a cold brew up to the gym lobby",
    detail: "Any brand. Leave it at the front desk if I’m still on a machine.",
    zone: "gym",
    north: 6,
    east: -10,
    urgency: "low",
    baseKarma: 10,
    bonusKarma: 0,
    createdAt: "7 min ago",
    ageMs: 420_000,
  },
  {
    id: "q4",
    requesterId: "seed-owen",
    requesterName: "Owen",
    title: "Meet at the plaza and swap a HDMI dongle",
    detail: "Red backpack near the fountain. 30-second handoff.",
    zone: "plaza",
    north: 16,
    east: 8,
    urgency: "urgent",
    baseKarma: 10,
    bonusKarma: 10,
    createdAt: "1 min ago",
    ageMs: 60_000,
  },
  {
    id: "q5",
    requesterId: "seed-sana",
    requesterName: "Sana",
    title: "Pick up a forgotten hoodie at the park bench",
    detail: "Navy hoodie on the third bench from the path. Text when you have it.",
    zone: "park",
    north: -12,
    east: 16,
    urgency: "medium",
    baseKarma: 20,
    bonusKarma: 5,
    createdAt: "11 min ago",
    ageMs: 660_000,
  },
  {
    id: "q6",
    requesterId: "seed-leo",
    requesterName: "Leo",
    title: "Return a reserved book to the library hold shelf",
    detail: "Thin blue hardcover with a sticky note. Drop at holds — 2 minutes.",
    zone: "library",
    north: -10,
    east: 20,
    urgency: "medium",
    baseKarma: 15,
    bonusKarma: 5,
    createdAt: "5 min ago",
    ageMs: 300_000,
  },
  {
    id: "q7",
    requesterId: "seed-aria",
    requesterName: "Aria",
    title: "Borrow a spare USB-C hub from the café counter",
    detail: "Gray Anker hub taped under the monitor cart. Meet at the door.",
    zone: "cafe",
    north: 14,
    east: -8,
    urgency: "urgent",
    baseKarma: 20,
    bonusKarma: 10,
    createdAt: "3 min ago",
    ageMs: 180_000,
  },
  {
    id: "q8",
    requesterId: "seed-nate",
    requesterName: "Nate",
    title: "Walk someone’s dog once around the park loop",
    detail: "Small corgi, leash on a bench. Owner is mid-call nearby.",
    zone: "park",
    north: 10,
    east: -18,
    urgency: "low",
    baseKarma: 15,
    bonusKarma: 0,
    createdAt: "9 min ago",
    ageMs: 540_000,
  },
  {
    id: "q9",
    requesterId: "seed-rhea",
    requesterName: "Rhea",
    title: "Drop off notes at the plaza notice board",
    detail: "Manila folder — just leave it labeled. I’m stuck across town.",
    zone: "plaza",
    north: -14,
    east: -12,
    urgency: "medium",
    baseKarma: 10,
    bonusKarma: 5,
    createdAt: "6 min ago",
    ageMs: 360_000,
  },
  {
    id: "q10",
    requesterId: "seed-kai",
    requesterName: "Kai",
    title: "Grab a protein shake for someone at the gym",
    detail: "Chocolate whey from the café. Leave at locker bay C.",
    zone: "gym",
    north: -16,
    east: 12,
    urgency: "urgent",
    baseKarma: 20,
    bonusKarma: 10,
    createdAt: "8 min ago",
    ageMs: 480_000,
  },
  {
    id: "q11",
    requesterId: "seed-mina",
    requesterName: "Mina",
    title: "Watch a laptop at the café for ten minutes",
    detail: "Silver Mac near the outlet wall. Bathroom run — just sit nearby.",
    zone: "cafe",
    north: 4,
    east: 20,
    urgency: "urgent",
    baseKarma: 25,
    bonusKarma: 5,
    createdAt: "1 min ago",
    ageMs: 50_000,
  },
  {
    id: "q12",
    requesterId: "seed-dev",
    requesterName: "Dev",
    title: "Pick up a forgotten umbrella at the library lobby",
    detail: "Clear bubble umbrella by the entrance rack.",
    zone: "library",
    north: 5,
    east: 6,
    urgency: "low",
    baseKarma: 10,
    bonusKarma: 0,
    createdAt: "14 min ago",
    ageMs: 840_000,
  },
];

function buildQuests(origin: LatLng, zones: Zone[]): Quest[] {
  const now = Date.now();
  return QUEST_SEEDS.map((seed) => {
    const base = zones.find((z) => z.id === seed.zone)!;
    const p = offsetLatLng({ lat: base.lat, lng: base.lng }, seed.north, seed.east);
    return {
      id: seed.id,
      requesterId: seed.requesterId,
      requesterName: seed.requesterName,
      title: seed.title,
      detail: seed.detail,
      zone: seed.zone,
      lat: p.lat,
      lng: p.lng,
      urgency: seed.urgency,
      baseKarma: seed.baseKarma,
      bonusKarma: seed.bonusKarma,
      status: "OPEN" as const,
      createdAt: seed.createdAt,
      updatedAt: now - seed.ageMs,
    };
  });
}

/** Default origin only until live GPS arrives — anywhere, not a campus. */
export let WORLD_ORIGIN: LatLng = { lat: 40.7128, lng: -74.006 };
export let ZONES: Zone[] = buildZones(WORLD_ORIGIN);
export let MOCK_QUESTS: Quest[] = buildQuests(WORLD_ORIGIN, ZONES);

/** Re-center synthetic places + favors around the user’s real GPS. */
export function anchorWorld(origin: LatLng) {
  WORLD_ORIGIN = origin;
  ZONES = buildZones(origin);
  MOCK_QUESTS = buildQuests(origin, ZONES);
  return { origin, zones: ZONES, quests: MOCK_QUESTS };
}

const MAX_ZONE = 9;

export function zoneById(id: ZoneId) {
  return ZONES.find((z) => z.id === id) ?? ZONES[0];
}

export function questPin(quest: Pick<Quest, "zone" | "lat" | "lng">): LatLng {
  if (typeof quest.lat === "number" && typeof quest.lng === "number") {
    return { lat: quest.lat, lng: quest.lng };
  }
  const z = zoneById(quest.zone);
  return { lat: z.lat, lng: z.lng };
}

export function minutesAway(from: ZoneId, to: ZoneId) {
  return MINUTES[from]?.[to] ?? 5;
}

export function scoreQuest(user: Session, quest: Quest): ScoredQuest {
  const mins = minutesAway(user.zone, quest.zone);
  const proximity = 1 - mins / MAX_ZONE;
  const urgency = URGENCY_SCORE[quest.urgency];
  const reward = (quest.baseKarma + quest.bonusKarma) / 40;
  const reliability = user.completed / (user.completed + user.bailed + 1);
  const score = 0.4 * proximity + 0.25 * urgency + 0.2 * reward + 0.15 * reliability;

  const bits = [
    mins === 0 ? "same zone" : `${mins} min away`,
    quest.urgency === "urgent" ? "urgent" : quest.urgency === "medium" ? "medium" : null,
    user.completed > 0 ? `you’ve completed ${user.completed}` : "fresh helper",
  ].filter(Boolean);

  return {
    ...quest,
    score,
    minutesAway: mins,
    why: bits.join(" · "),
  };
}

export function rankedFeed(user: Session, quests: Quest[]) {
  return quests
    .filter((q) => q.status === "OPEN" && q.requesterId !== user.id)
    .map((q) => scoreQuest(user, q))
    .sort((a, b) => b.score - a.score);
}

export function shortestPath(from: ZoneId, to: ZoneId): ZoneId[] {
  if (from === to) return [from];

  const ids = ZONES.map((z) => z.id);
  const dist = new Map<ZoneId, number>();
  const prev = new Map<ZoneId, ZoneId | null>();
  for (const id of ids) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(from, 0);

  const remaining = new Set(ids);
  while (remaining.size) {
    let u: ZoneId | null = null;
    let best = Infinity;
    for (const id of remaining) {
      const d = dist.get(id)!;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || best === Infinity) break;
    remaining.delete(u);
    if (u === to) break;
    for (const v of ids) {
      if (!remaining.has(v)) continue;
      const alt = best + (MINUTES[u][v] ?? 99);
      if (alt < dist.get(v)!) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }

  const path: ZoneId[] = [];
  let cur: ZoneId | null = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
    if (cur === from) {
      path.unshift(from);
      break;
    }
  }
  return path[0] === from ? path : [from, to];
}

function matchZoneToken(token: string): ZoneId | null {
  const t = token.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;

  for (const z of ZONES) {
    const names = [z.id, z.short, z.name].map((s) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (names.some((n) => n === t || t.includes(n) || n.includes(t))) return z.id;
  }

  if (t.includes("cafe") || t.includes("café") || t.includes("coffee")) return "cafe";
  if (t.includes("library") || t.includes("book")) return "library";
  if (t.includes("park") || t.includes("green")) return "park";
  if (t.includes("gym") || t.includes("fitness")) return "gym";
  if (t.includes("plaza") || t.includes("square") || t.includes("center")) return "plaza";
  return null;
}

export function parseRouteQuery(query: string): { from: ZoneId; to: ZoneId } | null {
  const raw = query.trim();
  if (!raw) return null;

  const parts = raw.split(/\s*(?:→|->|—|–|to|toward|towards)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    const from = matchZoneToken(parts[0]);
    const to = matchZoneToken(parts[parts.length - 1]);
    if (from && to) return { from, to };
  }

  const found: ZoneId[] = [];
  for (const z of ZONES) {
    const needles = [z.short, z.name, z.id];
    if (needles.some((n) => raw.toLowerCase().includes(n.toLowerCase()))) {
      if (!found.includes(z.id)) found.push(z.id);
    }
  }
  if (found.length >= 2) return { from: found[0], to: found[1] };
  return null;
}

export function buildRoute(from: ZoneId, to: ZoneId): CampusRoute {
  const zones = shortestPath(from, to);
  const path = zones.map((id) => {
    const z = zoneById(id);
    return { lat: z.lat, lng: z.lng };
  });
  return {
    from,
    to,
    zones,
    path,
    label: `${zoneById(from).short} → ${zoneById(to).short}`,
  };
}

export function favorsOnRoute(quests: ScoredQuest[], route: CampusRoute | null) {
  if (!route) return quests;
  if (route.zones?.length) {
    const set = new Set(route.zones);
    return quests.filter((q) => set.has(q.zone));
  }
  return quests;
}

export const ROUTE_EXAMPLES = ["Library to Café", "Plaza → Park", "Gym to Library", "Café to Plaza"];
export const PLACE_EXAMPLES = ["Tepper School of Business", "Hunt Library", "Carnegie Mellon University"];

export const KARMA_COST: Record<Urgency, { base: number; bonus: number }> = {
  low: { base: 10, bonus: 0 },
  medium: { base: 20, bonus: 5 },
  urgent: { base: 20, bonus: 10 },
};

export const ZONE_IDS: ZoneId[] = ["plaza", "cafe", "library", "park", "gym"];

/** Helper has five minutes to walk before the claim auto-releases. */
export const CLAIM_MS = 5 * 60 * 1000;
