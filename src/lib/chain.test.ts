import { findChain, type Edge } from "./chain";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function edge(
  from: string,
  to: string,
  at: number,
  title = `${from}→${to}`,
): Edge {
  return {
    from,
    fromName: from,
    to,
    toName: to,
    title,
    karma: 25,
    at,
  };
}

// Closing 3-hop loop: Maya → Jules → Priya → Maya
{
  const edges = [
    edge("maya", "jules", 100, "charger"),
    edge("jules", "priya", 200, "table"),
    edge("priya", "maya", 300, "hoodie"),
  ];
  const result = findChain(edges);
  assert(result, "expected a chain");
  assert(result.closesLoop, "expected closing loop");
  assert(result.hops.length === 3, `expected 3 hops, got ${result.hops.length}`);
  assert(result.hops[0]!.from === "maya" && result.hops[2]!.to === "maya", "loop endpoints");
  console.log("PASS closing 3-hop loop");
}

// Non-closing chain: A → B → C (no return)
{
  const edges = [
    edge("a", "b", 100),
    edge("b", "c", 200),
    edge("x", "y", 150),
  ];
  const result = findChain(edges);
  assert(result, "expected open chain");
  assert(!result.closesLoop, "should not close");
  assert(result.hops.length === 2, `expected 2 hops, got ${result.hops.length}`);
  assert(result.hops[0]!.from === "a" && result.hops[1]!.to === "c", "a→b→c");
  console.log("PASS non-closing chain");
}

// Null when fewer than 2 edges
{
  assert(findChain([]) === null, "empty → null");
  assert(findChain([edge("a", "b", 1)]) === null, "single → null");
  console.log("PASS null case");
}

console.log("\nAll chain tests passed.");
