"use client";

import type { CityContext } from "@/lib/types";

function fmtDate(raw?: string) {
  if (!raw) return "Date not on file";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString();
}

export function AchdRecordsDrawer({
  open,
  onClose,
  context,
  addressLabel,
}: {
  open: boolean;
  onClose: () => void;
  context?: CityContext;
  addressLabel?: string;
}) {
  if (!open) return null;

  const inspections = context?.inspections ?? [];
  const violations = context?.violations ?? [];
  const requests = context?.serviceRequests ?? [];
  const byInsp = new Map<string, typeof violations>();
  for (const v of violations) {
    const key = v.inspectionId || "unlinked";
    const list = byInsp.get(key) ?? [];
    list.push(v);
    byInsp.set(key, list);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close records" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-950 p-4 text-white shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">ACHD Housing & Community Environment</p>
            <h2 className="mt-1 text-lg font-semibold">
              {addressLabel ? addressLabel.replace(/\b\w/g, (c) => c) : "County file"}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              {`${inspections.length} inspection${inspections.length === 1 ? "" : "s"} · ${violations.length} cited condition${violations.length === 1 ? "" : "s"} · ${requests.length} service request${requests.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
          >
            Close
          </button>
        </div>

        {!inspections.length && !violations.length && !requests.length ? (
          <p className="mt-4 text-sm text-zinc-400">No Housing & Community Environment rows matched this street.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {inspections.map((row) => {
              const cites = byInsp.get(row.inspectionId) ?? [];
              return (
                <li key={row.inspectionId || `${row.date}-${row.type}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{fmtDate(row.date)}</p>
                  <p className="mt-1 text-sm font-medium">{row.type || "Inspection"}</p>
                  {row.requestType && <p className="text-xs text-zinc-400">{row.requestType}</p>}
                  {row.serviceRequest && (
                    <p className="mt-1 text-[11px] text-zinc-500">SR {row.serviceRequest}</p>
                  )}
                  {cites.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {cites.map((v) => (
                        <li key={`${v.inspectionId}:${v.violation}:${v.date}`} className="text-xs">
                          <span className="text-rose-200">{v.violation}</span>
                          {v.status ? (
                            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                              {v.status}
                            </span>
                          ) : (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">
                              Status not on file
                            </span>
                          )}
                          {v.description ? <p className="mt-0.5 text-[11px] text-zinc-500">{v.description}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-500">No cited conditions attached to this inspection id.</p>
                  )}
                </li>
              );
            })}
            {violations
              .filter((v) => !inspections.some((i) => i.inspectionId === v.inspectionId))
              .map((v) => (
                <li key={`orphan:${v.inspectionId}:${v.violation}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{fmtDate(v.date)}</p>
                  <p className="mt-1 text-sm text-rose-200">{v.violation}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                    {v.status || "Status not on file"}
                  </p>
                </li>
              ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
