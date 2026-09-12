import { NextRequest } from "next/server";
import { createUser } from "@/lib/store";
import type { ZoneId } from "@/lib/types";

const ZONES: ZoneId[] = ["tepper-2f", "tepper-3f", "gates-4f", "hunt", "outside"];

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; zone?: ZoneId };
  const name = body.name?.trim() || "Guest";
  const zone = body.zone && ZONES.includes(body.zone) ? body.zone : "tepper-2f";
  const user = createUser(name, zone);
  return Response.json({ user });
}
