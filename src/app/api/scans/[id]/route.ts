import { deleteScan, getScan } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const scan = await getScan(id);
  if (!scan) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ scan });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteScan(id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
