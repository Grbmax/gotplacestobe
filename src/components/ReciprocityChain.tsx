"use client";

import type { ChainResult } from "@/lib/chain";

type Props = {
  chain: ChainResult | null;
};

function relativeTime(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ReciprocityChain({ chain }: Props) {
  if (!chain || chain.hops.length < 2) return null;

  const names = [chain.hops[0]!.fromName, ...chain.hops.map((h) => h.toName)];

  return (
    <section
      className={`mx-5 mt-4 rounded-2xl border p-4 ${
        chain.closesLoop ? "border-leaf bg-leaf/10" : "border-paper/15 bg-paper/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-paper/45">Tonight’s chain</p>
        {chain.closesLoop && (
          <span className="rounded-full bg-leaf px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
            Closed loop
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {names.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-leaf/80">→</span>}
            <span className="font-medium text-paper">{name}</span>
          </span>
        ))}
        {chain.closesLoop && <span className="text-leaf/80">↻</span>}
      </div>

      <ul className="mt-4 space-y-2 border-t border-paper/10 pt-3">
        {chain.hops.map((hop) => (
          <li key={`${hop.from}-${hop.to}-${hop.at}`} className="text-xs text-paper/55">
            <span className="text-paper/80">
              {hop.fromName} → {hop.toName}
            </span>
            <span className="text-paper/35"> · </span>
            {hop.title}
            <span className="text-paper/35"> · </span>
            {relativeTime(hop.at)}
            <span className="text-leaf/70"> · +{hop.karma}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
