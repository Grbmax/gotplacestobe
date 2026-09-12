import { NextRequest } from "next/server";
import { createScan, listScans } from "@/lib/store";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const scans = await listScans({
    propertyId: sp.get("propertyId") ?? undefined,
    room: sp.get("room") ?? undefined,
    surface: sp.get("surface") ?? undefined,
  });
  return Response.json({ scans });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    propertyId?: string;
    room?: string;
    surface?: string;
    image?: string;
    scannedBy?: string;
    scannedByName?: string;
  };
  if (!body.propertyId || !body.room || !body.surface || !body.image) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!body.image.startsWith("data:image/")) {
    return Response.json({ error: "image must be a data URL" }, { status: 400 });
  }
  const result = await createScan({
    propertyId: body.propertyId,
    room: body.room,
    surface: body.surface,
    image: body.image,
    scannedBy: body.scannedBy,
    scannedByName: body.scannedByName,
  });
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(result);
}
