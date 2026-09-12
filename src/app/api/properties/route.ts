import { NextRequest } from "next/server";
import { createProperty, listProperties } from "@/lib/scan/store";
import type { Property } from "@/lib/scan/types";

export async function GET() {
  const properties = await listProperties();
  return Response.json({ properties });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { label?: string; kind?: Property["kind"] };
  if (!body.label?.trim() || !body.kind) {
    return Response.json({ error: "Missing label or kind" }, { status: 400 });
  }
  if (!["lease", "sublet", "stay"].includes(body.kind)) {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  const property = await createProperty({ label: body.label, kind: body.kind });
  return Response.json({ property });
}
