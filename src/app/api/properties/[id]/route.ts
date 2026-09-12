import { NextRequest } from "next/server";
import { getProperty, refreshPropertyCity } from "@/lib/store";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const property = await getProperty(id);
  if (!property) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ property });
}

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const property = await refreshPropertyCity(id);
  if (!property) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ property });
}
