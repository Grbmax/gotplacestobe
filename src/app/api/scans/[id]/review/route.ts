import { NextRequest } from "next/server";
import { reviewScan } from "@/lib/store";
import type { Review } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    verdict?: Review["verdict"];
    reviewerRole?: Review["reviewerRole"];
    note?: string;
  };
  if (!body.verdict || !body.reviewerRole) {
    return Response.json({ error: "Missing verdict or reviewerRole" }, { status: 400 });
  }
  if (!["confirmed", "disputed"].includes(body.verdict)) {
    return Response.json({ error: "Invalid verdict" }, { status: 400 });
  }
  if (!["tenant", "owner", "inspector"].includes(body.reviewerRole)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  const scan = await reviewScan(id, {
    verdict: body.verdict,
    reviewerRole: body.reviewerRole,
    note: body.note,
  });
  if (!scan) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ scan });
}
