import { NextRequest } from "next/server";
import { runDetect } from "@/lib/scan/detect";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { image?: string };
  if (!body.image?.startsWith("data:image/")) {
    return Response.json({ error: "image must be a data URL" }, { status: 400 });
  }
  const result = await runDetect(body.image);
  return Response.json(result);
}
