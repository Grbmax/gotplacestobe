"use client";

import { useState } from "react";
import type { CityContext, Scan } from "@/lib/types";
import { dashboardTiles, type Tone } from "@/lib/dashboard";
import { applyCivicToScans } from "@/lib/escalate";
import { grantMatch } from "@/lib/grants";

const TONE: Record<Tone, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  rose: "border-rose-500/35 bg-rose-500/10 text-rose-100",
  zinc: "border-zinc-700 bg-zinc-900 text-zinc-200",
};

const HEADLINE: Record<Tone, string> = {
  green: "text-emerald-200",
  amber: "text-amber-100",
  rose: "text-rose-100",
  zinc: "text-zinc-200",
};

export function HouseDashboard({
  context,
  scans,
}: {
  context?: CityContext;
  scans: Scan[];
}) {
  const civicScans = applyCivicToScans(scans, context);
  const { overall, headline, tiles } = dashboardTiles(context, civicScans);
  const grant = grantMatch(context, civicScans);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tiles.find((t) => t.id === selectedId) ?? null;

  return (
    <section className="mt-5 space-y-2">
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Alerts</p>
          <p className={`text-sm font-medium ${HEADLINE[overall]}`}>{headline}</p>
        </div>
        {context?.zipCode && (
          <p className="text-[10px] text-zinc-500">ZIP {context.zipCode}</p>
        )}
      </div>

      {grant.eligible && (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs leading-snug text-emerald-100">
          May qualify for free county lead testing and home repair help.
        </p>
      )}

      {context?.civic?.prompt && (
        <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs leading-snug text-sky-100">
          {context.civic.prompt}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {tiles.slice(0, 4).map((tile) => {
          const on = selectedId === tile.id;
          return (
            <button
              type="button"
              key={tile.id}
              onClick={() => setSelectedId(on ? null : tile.id)}
              aria-pressed={on}
              className={`rounded-xl border px-3 py-2.5 text-left ${TONE[tile.tone]} ${on ? "ring-2 ring-white/40" : ""}`}
            >
              <p className="text-[9px] uppercase tracking-[0.14em] opacity-70">{tile.kicker}</p>
              <h3 className="mt-1 text-[13px] font-medium leading-snug">{tile.title}</h3>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={`rounded-xl border px-3 py-3 ${TONE[selected.tone]}`}>
          <p className="text-[9px] uppercase tracking-[0.14em] opacity-70">
            {selected.kicker} · what this means
          </p>
          <h3 className="mt-1 text-sm font-medium">{selected.title}</h3>
          <p className="mt-2 text-xs leading-relaxed opacity-90">{selected.body}</p>
          <p className="mt-2 text-xs leading-relaxed opacity-80">{selected.read}</p>
          {selected.notes?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] opacity-80">
              {selected.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {selected.id === "paint" && grant.eligible && (
            <p className="mt-2 text-[11px] leading-relaxed opacity-80">{grant.body}</p>
          )}
        </div>
      )}

      <p className="px-0.5 text-[9px] leading-relaxed text-zinc-600">
        Blood-lead rates are among children who were tested, not this household. ACHD censors small
        counts. Tap a tile for the reading.
      </p>
    </section>
  );
}
