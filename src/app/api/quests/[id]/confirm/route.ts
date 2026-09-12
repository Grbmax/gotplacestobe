import { NextRequest } from "next/server";
import { confirmQuest } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/quests/[id]/confirm">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { userId?: string };
  if (!body.userId) return Response.json({ error: "Missing userId" }, { status: 400 });
  const result = await confirmQuest(id, body.userId);
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(result);
}
