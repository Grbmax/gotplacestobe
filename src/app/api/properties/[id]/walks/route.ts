import { NextRequest } from "next/server";
import { createWalk } from "@/lib/store";
import type { WalkKind } from "@/lib/types";

const KINDS: WalkKind[] = ["move_in", "mid", "exit"];

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    kind?: WalkKind;
    createdBy?: string;
    createdByName?: string;
  };
  if (!body.kind || !KINDS.includes(body.kind)) {
    return Response.json({ error: "kind must be move_in, mid, or exit" }, { status: 400 });
  }
  const result = await createWalk({
    propertyId: id,
    kind: body.kind,
    createdBy: body.createdBy,
    createdByName: body.createdByName,
  });
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(result);
}
