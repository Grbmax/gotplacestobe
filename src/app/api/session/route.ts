import { NextRequest } from "next/server";
import { ZONE_IDS } from "@/lib/data";
import { createUser } from "@/lib/store";
import type { ZoneId } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; zone?: ZoneId };
  const name = body.name?.trim() || "Guest";
  const zone = body.zone && ZONE_IDS.includes(body.zone) ? body.zone : "plaza";
  const user = await createUser(name, zone);
  return Response.json({ user });
}
