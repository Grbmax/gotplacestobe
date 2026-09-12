import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ features: [] });
  }

  const limit = request.nextUrl.searchParams.get("limit") ?? "6";
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");

  const params = new URLSearchParams({
    q,
    limit,
    lang: "en",
  });
  if (lat && lon) {
    params.set("lat", lat);
    params.set("lon", lon);
  }

  const upstream = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QuestApp/0.1 (gotplacestobe; place search)",
    },
    next: { revalidate: 0 },
  });

  if (!upstream.ok) {
    return Response.json({ error: "Upstream place search failed" }, { status: 502 });
  }

  const data = await upstream.json();
  return Response.json(data);
}
