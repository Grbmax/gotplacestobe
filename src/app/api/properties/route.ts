import { NextRequest } from "next/server";
import { createProperty, listProperties } from "@/lib/store";
import type { Property } from "@/lib/types";

export async function GET() {
  const properties = await listProperties();
  return Response.json({ properties });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { label?: string; kind?: Property["kind"]; unit?: string };
  if (!body.label?.trim() || !body.kind) {
    return Response.json({ error: "Missing label or kind" }, { status: 400 });
  }
  if (!["lease", "sublet", "stay"].includes(body.kind)) {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  const { property, reused } = await createProperty({
    label: body.label,
    kind: body.kind,
    unit: body.unit,
  });
  return Response.json({ property, reused });
}
