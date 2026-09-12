import { getScanImage } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const image = await getScanImage(id);
  if (!image) return new Response("Not found", { status: 404 });

  if (image.kind === "url") {
    return Response.redirect(image.url, 302);
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
