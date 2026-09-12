import { NextRequest } from "next/server";
import { createQuest, listQuests } from "@/lib/store";
import type { Urgency, ZoneId } from "@/lib/types";

export async function GET(request: NextRequest) {
  const sinceRaw = request.nextUrl.searchParams.get("since");
  const since = sinceRaw ? Number(sinceRaw) : undefined;
  return Response.json(await listQuests(Number.isFinite(since) ? since : undefined));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    title?: string;
    zone?: ZoneId;
    urgency?: Urgency;
  };
  if (!body.userId || !body.zone || !body.urgency) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  const result = await createQuest({
    userId: body.userId,
    title: body.title ?? "",
    zone: body.zone,
    urgency: body.urgency,
  });
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(result);
}
