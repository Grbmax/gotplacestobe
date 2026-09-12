import type { LatLng } from "./types";

export type PlaceSuggestion = {
  id: string;
  label: string;
  subtitle: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    district?: string;
    locality?: string;
    type?: string;
  };
};

function buildLabel(p: NonNullable<PhotonFeature["properties"]>) {
  const primary =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.street ||
    p.locality ||
    "Place";
  const subtitle = [p.district || p.locality, p.city, p.state, p.country]
    .filter(Boolean)
    .filter((part, i, arr) => arr.indexOf(part) === i)
    .join(", ");
  return { label: primary, subtitle };
}

/** Place autocomplete via Photon (Komoot) — built for as-you-type search. */
export async function searchPlaces(
  query: string,
  opts?: { lat?: number; lng?: number; limit?: number; signal?: AbortSignal },
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: String(opts?.limit ?? 6),
    lang: "en",
  });
  if (typeof opts?.lat === "number" && typeof opts?.lng === "number") {
    params.set("lat", String(opts.lat));
    params.set("lon", String(opts.lng));
  }

  const res = await fetch(`/api/places?${params}`, {
    signal: opts?.signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("places");
  const data = (await res.json()) as { features?: PhotonFeature[] };

  return (data.features ?? [])
    .map((f, i) => {
      const coords = f.geometry?.coordinates;
      const props = f.properties;
      if (!coords || !props) return null;
      const [lng, lat] = coords;
      const { label, subtitle } = buildLabel(props);
      return {
        id: String(props.osm_id ?? `${lat},${lng},${i}`),
        label,
        subtitle,
        lat,
        lng,
      } satisfies PlaceSuggestion;
    })
    .filter((x): x is PlaceSuggestion => Boolean(x));
}

/** Walking path from A → B via public OSRM. Falls back to a straight segment. */
export async function fetchWalkingPath(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const res = await fetch(
      `/api/directions?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error("directions");
    const data = (await res.json()) as { path?: LatLng[] };
    if (data.path && data.path.length >= 2) return data.path;
  } catch {
    /* fall through */
  }
  return [from, to];
}

export function parsePhotonPayload(data: { features?: PhotonFeature[] }): PlaceSuggestion[] {
  return (data.features ?? [])
    .map((f, i) => {
      const coords = f.geometry?.coordinates;
      const props = f.properties;
      if (!coords || !props) return null;
      const [lng, lat] = coords;
      const { label, subtitle } = buildLabel(props);
      return {
        id: String(props.osm_id ?? `${lat},${lng},${i}`),
        label,
        subtitle,
        lat,
        lng,
      } satisfies PlaceSuggestion;
    })
    .filter((x): x is PlaceSuggestion => Boolean(x));
}
