export type Edge = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  title: string;
  karma: number;
  at: number;
};

export type ChainResult = {
  hops: Edge[];
  closesLoop: boolean;
};

/**
 * Longest reciprocity path over time-sorted confirmed edges.
 * Prefers a closing loop (A→…→A); otherwise the longest open chain.
 */
export function findChain(edges: Edge[]): ChainResult | null {
  if (edges.length < 2) return null;

  let bestLoop: ChainResult | null = null;
  let bestOpen: ChainResult | null = null;

  function consider(hops: Edge[]) {
    if (hops.length < 2) return;
    const closesLoop = hops[hops.length - 1]!.to === hops[0]!.from;
    const candidate: ChainResult = { hops: hops.slice(), closesLoop };
    if (closesLoop) {
      if (!bestLoop || candidate.hops.length > bestLoop.hops.length) bestLoop = candidate;
    } else if (!bestOpen || candidate.hops.length > bestOpen.hops.length) {
      bestOpen = candidate;
    }
  }

  function dfs(startIdx: number, hops: Edge[], lastIdx: number) {
    consider(hops);
    const last = hops[hops.length - 1]!;
    for (let j = lastIdx + 1; j < edges.length; j++) {
      const next = edges[j]!;
      if (next.from !== last.to) continue;
      hops.push(next);
      dfs(startIdx, hops, j);
      hops.pop();
    }
  }

  for (let i = 0; i < edges.length; i++) {
    dfs(i, [edges[i]!], i);
  }

  return bestLoop ?? bestOpen;
}
