import { findChain } from "@/lib/chain";
import { getConfirmedEdges } from "@/lib/store";

export async function GET() {
  const edges = await getConfirmedEdges();
  const chain = findChain(edges);
  return Response.json({ chain });
}
