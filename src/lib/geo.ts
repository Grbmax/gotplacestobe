import { questPin, ZONES } from "./data";
import type { LatLng, ScoredQuest, ZoneId } from "./types";

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

export function metersBetween(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Pick the nearest synthetic place around the user’s live position. */
export function nearestZone(coords: LatLng): ZoneId {
  let best: ZoneId = ZONES[0].id;
  let bestDist = Infinity;
  for (const z of ZONES) {
    const d = metersBetween(coords, { lat: z.lat, lng: z.lng });
    if (d < bestDist) {
      bestDist = d;
      best = z.id;
    }
  }
  return best;
}

/** Keep favors that sit close to a real walking path / destination. */
export function favorsNearPath(quests: ScoredQuest[], path: LatLng[], maxMeters = 500) {
  if (!path.length) return quests;
  return quests.filter((q) => {
    const pin = questPin(q);
    return path.some((p) => metersBetween(pin, p) <= maxMeters);
  });
}
