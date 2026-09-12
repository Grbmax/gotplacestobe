import { CAMPUS_CENTER } from "./data";
import type { LatLng } from "./types";

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

export function isOnCampus(coords: LatLng) {
  return metersBetween(coords, CAMPUS_CENTER) < 1600;
}
