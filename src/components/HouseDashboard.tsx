"use client";

import { useState } from "react";
import type { CityContext, GrantCheck, Scan } from "@/lib/types";
import { dashboardTiles, type Tone } from "@/lib/dashboard";
import { applyCivicToScans } from "@/lib/escalate";
import { grantMatch } from "@/lib/grants";
import { buildLeadLine } from "@/lib/water";
import { AchdRecordsDrawer } from "@/components/AchdRecordsDrawer";

const TONE: Record<Tone, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  rose: "border-rose-500/35 bg-rose-500/10 text-rose-100",
  zinc: "border-zinc-700 bg-zinc-900 text-zinc-200",
};

const BANNER: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-zinc-950 text-emerald-100",
  amber: "border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-zinc-950 text-amber-50",
  rose: "border-rose-500/40 bg-gradient-to-br from-rose-500/25 to-zinc-950 text-rose-50",
  zinc: "border-zinc-700 bg-zinc-900 text-zinc-200",
};

function CheckRow({ check }: { check: GrantCheck }) {
  const mark = check.met === true ? "✓" : check.met === "unknown" ? "?" : "–";
  const color =
    check.met === true ? "text-emerald-200" : check.met === "unknown" ? "text-amber-200" : "text-zinc-400";
  return (
    <li className="flex gap-2 text-xs leading-snug">
      <span className={`mt-0.5 w-4 shrink-0 font-semibold ${color}`}>{mark}</span>
      <span>
        <span className="font-medium">{check.label}</span> {check.detail}
      </span>
    </li>
  );
}

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
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const selected = tiles.find((t) => t.id === selectedId) ?? null;
  const line = context?.leadLine ?? (context ? buildLeadLine(undefined, context.zipCode) : undefined);
  const fileTile = tiles.find((t) => t.id === "file");
  const chips = [
    context?.yearBuilt ? `Built ${context.yearBuilt}` : null,
    context?.zipCode ? `ZIP ${context.zipCode}` : null,
    grant.eligible ? "$12k repairs" : null,
    fileTile?.title && fileTile.title.startsWith("No") ? null : fileTile?.title,
    line?.isLead ? "Lead water line" : null,
  ].filter((c): c is string => Boolean(c));

  const hook = grant.eligible
    ? "May qualify for $12,000 in free lead-safe repairs"
    : headline;

  return (
    <section className="mt-4">
      <div className={`overflow-hidden rounded-2xl border ${BANNER[overall]}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">County file</p>
            <p className="mt-1 text-sm font-medium leading-snug">{hook}</p>
            {chips.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.slice(0, 4).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[10px] tracking-wide"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : hook !== headline ? (
              // Only show this when it says something the title line didn't already —
              // hook already equals headline outside the grant-eligible case, and
              // repeating it verbatim read as unfinished placeholder copy.
              <p className="mt-1 text-[11px] opacity-70">{headline}</p>
            ) : null}
          </div>
          <span className="mt-0.5 shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[10px] uppercase tracking-wider opacity-80">
            {open ? "Hide" : "Open"}
          </span>
        </button>

        {open && (
          <div className="space-y-2 border-t border-white/10 px-3 pb-3 pt-3">
            {grant.eligible && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-emerald-100">
                <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                  Allegheny Lead Safe Homes
                </p>
                <p className="mt-1 text-sm font-medium">{grant.title}</p>
                <p className="mt-1 text-xs leading-snug text-emerald-100/90">{grant.body}</p>
                <ul className="mt-2 space-y-1.5">
                  {grant.checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </ul>
                <a
                  href={grant.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black"
                >
                  {grant.applyLabel}
                </a>
              </div>
            )}

            {line && (
              <div
                className={`rounded-xl border px-3 py-3 ${
                  line.isLead
                    ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-100"
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">Water service line</p>
                <p className="mt-1 text-sm font-medium">
                  {line.isLead
                    ? "Main connection flagged as lead"
                    : line.matched
                      ? "Utility inventory on file"
                      : "Line material not in PWSA parcel file"}
                </p>
                <p className="mt-1 text-xs leading-snug opacity-90">{line.summary}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="opacity-60">Public (main → curb)</dt>
                    <dd className="font-medium">{line.publicStatus ?? "unknown"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Private (curb → house)</dt>
                    <dd className="font-medium">{line.privateStatus ?? "unknown"}</dd>
                  </div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={line.filterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-black"
                  >
                    {line.filterLabel}
                  </a>
                  <a
                    href={line.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/30 px-3 py-1.5 text-[11px]"
                  >
                    Utility map
                  </a>
                </div>
              </div>
            )}

            {context?.civic?.prompt && (
              <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs leading-snug text-sky-100">
                {context.civic.prompt}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {tiles.slice(0, 4).map((tile) => {
                const on = selectedId === tile.id && tile.id !== "file";
                return (
                  <button
                    type="button"
                    key={tile.id}
                    onClick={() => {
                      if (tile.id === "file") {
                        setRecordsOpen(true);
                        setSelectedId(null);
                        return;
                      }
                      setSelectedId(on ? null : tile.id);
                    }}
                    aria-pressed={tile.id === "file" ? recordsOpen : on}
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

            <p className="px-0.5 text-[9px] leading-relaxed text-zinc-500">
              Blood-lead rates are among children who were tested, not this household. ACHD censors
              small counts.
            </p>
          </div>
        )}
      </div>

      <AchdRecordsDrawer
        open={recordsOpen}
        onClose={() => setRecordsOpen(false)}
        context={context}
        addressLabel={context?.inspections[0]?.address || context?.serviceRequests[0]?.address}
      />
    </section>
  );
}
