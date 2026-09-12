import { NextRequest } from "next/server";

function parsePair(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const [a, b] = raw.split(",").map((n) => Number(n.trim()));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { lat: a, lng: b };
}

export async function GET(request: NextRequest) {
  const from = parsePair(request.nextUrl.searchParams.get("from"));
  const to = parsePair(request.nextUrl.searchParams.get("to"));
  if (!from || !to) {
    return Response.json({ error: "from and to required as lat,lng" }, { status: 400 });
  }

  const url =
    `https://router.project-osrm.org/route/v1/walking/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "QuestApp/0.1 (gotplacestobe; walking directions)",
      },
      next: { revalidate: 0 },
    });
    if (!upstream.ok) throw new Error("osrm");
    const data = (await upstream.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) throw new Error("empty");
    const path = coords.map(([lng, lat]) => ({ lat, lng }));
    return Response.json({ path });
  } catch {
    return Response.json({ path: [from, to] });
  }
}
