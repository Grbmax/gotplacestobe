import { NextRequest } from "next/server";
import { getMe } from "@/lib/store";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });
  const me = await getMe(userId);
  if (!me) return Response.json({ error: "Unknown session" }, { status: 404 });
  return Response.json(me);
}
