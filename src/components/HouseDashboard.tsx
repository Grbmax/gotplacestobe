"use client";

import { useState } from "react";
import type { CityContext, GrantCheck, Scan } from "@/lib/types";
import { dashboardTiles, type Tone } from "@/lib/dashboard";
import { applyCivicToScans } from "@/lib/escalate";
import { grantMatch } from "@/lib/grants";
import { buildLeadLine } from "@/lib/water";
import { AchdRecordsDrawer } from "@/components/AchdRecordsDrawer";

const TONE: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
  zinc: "border-slate-200 bg-white text-slate-800",
};

const BANNER: Record<Tone, string> = {
  green: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 text-emerald-950",
  amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950",
  rose: "border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950",
  zinc: "border-slate-200 bg-white text-slate-800",
};

const WPRDC_HCE =
  "https://data.wprdc.org/dataset/allegheny-county-healthy-homes-program-inspections";

function CheckRow({ check }: { check: GrantCheck }) {
  const mark = check.met === true ? "✓" : check.met === "unknown" ? "?" : "–";
  const color =
    check.met === true ? "text-emerald-700" : check.met === "unknown" ? "text-amber-700" : "text-slate-400";
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
  addressLabel,
}: {
  context?: CityContext;
  scans: Scan[];
  addressLabel?: string;
}) {
  const civicScans = applyCivicToScans(scans, context);
  const { overall, tiles } = dashboardTiles(context, civicScans);
  const grant = grantMatch(context, civicScans);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const selected = tiles.find((t) => t.id === selectedId) ?? null;
  const line = context?.leadLine ?? (context ? buildLeadLine(undefined, context.zipCode) : undefined);
  const fileTile = tiles.find((t) => t.id === "file");
  const inspections = context?.inspections ?? [];
  const violations = context?.violations ?? [];
  const topInsp = inspections[0];
  const topViol = violations[0];
  const matchedAddress =
    addressLabel ||
    topInsp?.address ||
    context?.serviceRequests?.[0]?.address ||
    null;
  const hasRecords = inspections.length + violations.length + (context?.serviceRequests?.length ?? 0) > 0;

  const title = hasRecords
    ? topInsp?.type || topViol?.violation || fileTile?.title || "ACHD housing record"
    : "No ACHD housing record matched";
  const detailBits = [
    matchedAddress,
    topInsp?.serviceRequest ? `SR ${topInsp.serviceRequest}` : topInsp?.inspectionId ? `Case ${topInsp.inspectionId}` : null,
    topViol?.status || (hasRecords ? null : "Lookup returned no row for this street"),
    topInsp?.date ? topInsp.date.slice(0, 10) : topViol?.date?.slice(0, 10) || null,
  ].filter(Boolean);

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
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">Allegheny County record</p>
            <p className="mt-1 text-sm font-medium leading-snug">{title}</p>
            {detailBits.length ? (
              <p className="mt-1 text-[11px] leading-snug opacity-80">{detailBits.join(" · ")}</p>
            ) : null}
            <a
              href={WPRDC_HCE}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-block text-[11px] font-medium text-sky-700 underline underline-offset-2"
            >
              Source: WPRDC ACHD inspections
            </a>
          </div>
          <span className="mt-0.5 shrink-0 rounded-full border border-slate-300/80 bg-white/70 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-600">
            {open ? "Hide" : "Open"}
          </span>
        </button>

        {open && (
          <div className="space-y-2 border-t border-slate-200/80 px-3 pb-3 pt-3">
            {grant.eligible && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-950">
                <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700/80">
                  Allegheny Lead Safe Homes
                </p>
                <p className="mt-1 text-sm font-medium">{grant.title}</p>
                <p className="mt-1 text-xs leading-snug text-emerald-900/90">{grant.body}</p>
                <ul className="mt-2 space-y-1.5">
                  {grant.checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </ul>
                <a
                  href={grant.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {grant.applyLabel}
                </a>
              </div>
            )}

            {line && (
              <div
                className={`rounded-xl border px-3 py-3 ${
                  line.isLead
                    ? "border-rose-200 bg-rose-50 text-rose-950"
                    : "border-sky-200 bg-sky-50 text-sky-950"
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
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white"
                  >
                    {line.filterLabel}
                  </a>
                  <a
                    href={line.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-[11px]"
                  >
                    Utility map
                  </a>
                </div>
              </div>
            )}

            {context?.civic?.prompt && (
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-snug text-sky-950">
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
                    className={`rounded-xl border px-3 py-2.5 text-left ${TONE[tile.tone]} ${on ? "ring-2 ring-sky-400/50" : ""}`}
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

            <p className="px-0.5 text-[9px] leading-relaxed text-slate-500">
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
        addressLabel={matchedAddress ?? undefined}
      />
    </section>
  );
}
