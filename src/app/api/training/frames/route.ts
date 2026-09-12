import { NextRequest } from "next/server";
import { listTrainingFrameMeta } from "@/lib/frames";
import { hasMongo } from "@/lib/db";

/** List training-frame metadata (no image bytes). Useful to verify the corpus is growing. */
export async function GET(request: NextRequest) {
  if (!hasMongo()) {
    return Response.json(
      { frames: [], warning: "MONGODB_URI not set — frames are only archived when Mongo is configured" },
      { status: 200 },
    );
  }
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const frames = await listTrainingFrameMeta(Number.isFinite(limit) ? limit : 50);
  return Response.json({ frames, count: frames.length });
}
