import type { Quest, ScoredQuest, Session, Urgency, Zone, ZoneId } from "./types";

export const ZONES: Zone[] = [
  { id: "hunt", name: "Hunt Library", short: "Hunt", x: 18, y: 42, lat: 40.44118, lng: -79.94368 },
  { id: "gates-4f", name: "Gates 4F", short: "Gates", x: 46, y: 28, lat: 40.44372, lng: -79.94454 },
  { id: "outside", name: "The Cut / Outside", short: "Outside", x: 50, y: 52, lat: 40.44238, lng: -79.94295 },
  { id: "tepper-2f", name: "Tepper 2F", short: "Tepper 2", x: 78, y: 38, lat: 40.44455, lng: -79.94605 },
  { id: "tepper-3f", name: "Tepper 3F", short: "Tepper 3", x: 82, y: 22, lat: 40.44492, lng: -79.94632 },
];

const MINUTES: Record<ZoneId, Record<ZoneId, number>> = {
  "tepper-2f": { "tepper-2f": 0, "tepper-3f": 2, "gates-4f": 6, hunt: 8, outside: 4 },
  "tepper-3f": { "tepper-2f": 2, "tepper-3f": 0, "gates-4f": 7, hunt: 9, outside: 5 },
  "gates-4f": { "tepper-2f": 6, "tepper-3f": 7, hunt: 4, outside: 3, "gates-4f": 0 },
  hunt: { "tepper-2f": 8, "tepper-3f": 9, "gates-4f": 4, hunt: 0, outside: 3 },
  outside: { "tepper-2f": 4, "tepper-3f": 5, "gates-4f": 3, hunt: 3, outside: 0 },
};

const URGENCY_SCORE: Record<Urgency, number> = {
  low: 0,
  medium: 0.5,
  urgent: 1,
};

const now = Date.now();

export const MOCK_QUESTS: Quest[] = [
  {
    id: "q1",
    requesterId: "seed-maya",
    requesterName: "Maya",
    title: "Grab my charger from Hunt 2nd floor desk",
    detail:
      "Black Anker brick under the west windows. I left it next to a green Nalgene. I’ll confirm the second you drop it at Tepper.",
    zone: "hunt",
    urgency: "urgent",
    baseKarma: 20,
    bonusKarma: 10,
    status: "OPEN",
    createdAt: "2 min ago",
    updatedAt: now - 120_000,
  },
  {
    id: "q2",
    requesterId: "seed-jules",
    requesterName: "Jules",
    title: "Hold my table at Gates while I print",
    detail:
      "Corner booth by the windows. Need someone sitting there for ~8 minutes so we don’t lose it before standup.",
    zone: "gates-4f",
    urgency: "medium",
    baseKarma: 20,
    bonusKarma: 5,
    status: "OPEN",
    createdAt: "4 min ago",
    updatedAt: now - 240_000,
  },
  {
    id: "q3",
    requesterId: "seed-priya",
    requesterName: "Priya",
    title: "Walk a Red Bull up to Tepper 3F",
    detail: "Any flavor. I’m stuck in a group room until 1. Leave it by 3310 if I’m not at the door.",
    zone: "tepper-3f",
    urgency: "low",
    baseKarma: 10,
    bonusKarma: 0,
    status: "OPEN",
    createdAt: "7 min ago",
    updatedAt: now - 420_000,
  },
  {
    id: "q4",
    requesterId: "seed-owen",
    requesterName: "Owen",
    title: "Meet me outside and swap a HDMI dongle",
    detail: "I’ll be on the Cut with a red backpack. 30-second handoff, then I’m in a pitch.",
    zone: "outside",
    urgency: "urgent",
    baseKarma: 10,
    bonusKarma: 10,
    status: "OPEN",
    createdAt: "1 min ago",
    updatedAt: now - 60_000,
  },
  {
    id: "q5",
    requesterId: "seed-sana",
    requesterName: "Sana",
    title: "Pick up a forgotten hoodie from Tepper 2F",
    detail: "Navy CMU hoodie on the back of a chair near the café. Text when you have it.",
    zone: "tepper-2f",
    urgency: "medium",
    baseKarma: 20,
    bonusKarma: 5,
    status: "OPEN",
    createdAt: "11 min ago",
    updatedAt: now - 660_000,
  },
];

const MAX_ZONE = 9;

export function zoneById(id: ZoneId) {
  return ZONES.find((z) => z.id === id)!;
}

export function minutesAway(from: ZoneId, to: ZoneId) {
  return MINUTES[from][to];
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

export const KARMA_COST: Record<Urgency, { base: number; bonus: number }> = {
  low: { base: 10, bonus: 0 },
  medium: { base: 20, bonus: 5 },
  urgent: { base: 20, bonus: 10 },
};

export const CAMPUS_CENTER = { lat: 40.4432, lng: -79.9436 };

/** Tight CMU envelope — map never pans past this. */
export const CAMPUS_BOUNDS = {
  southWest: { lat: 40.4388, lng: -79.9518 },
  northEast: { lat: 40.4478, lng: -79.9368 },
} as const;

export const CLAIM_MS = 5 * 60 * 1000;
