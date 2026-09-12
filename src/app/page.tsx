"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IdentityChip } from "@/components/IdentityChip";
import { ROLE_BLURB } from "@/lib/identity";
import { useIdentity } from "@/lib/IdentityContext";
import type { Property } from "@/lib/types";

type Summary = {
  property: Property;
  lastScannedAt: string | null;
  worstRatio: number;
  scanCount: number;
};

export default function HomePage() {
  const { identity } = useIdentity();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Property["kind"]>("lease");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/properties", { cache: "no-store" });
    const data = (await res.json()) as { properties: Property[] };
    const summaries: Summary[] = [];
    for (const property of data.properties) {
      const sRes = await fetch(`/api/scans?propertyId=${property.id}`, { cache: "no-store" });
      const sData = (await sRes.json()) as { scans: { capturedAt: string; totalAffectedRatio: number }[] };
      const scans = sData.scans ?? [];
      summaries.push({
        property,
        lastScannedAt: scans[0]?.capturedAt ?? null,
        worstRatio: scans.reduce((m, s) => Math.max(m, s.totalAffectedRatio), 0),
        scanCount: scans.length,
      });
    }
    setRows(summaries);
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load properties"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind, createdBy: identity.id, createdByName: identity.name }),
      });
      if (!res.ok) throw new Error("create failed");
      setLabel("");
      await load();
    } catch {
      setError("Could not create property");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    if (showAll) return rows;
    return rows.filter((r) => r.property.isSample || r.property.createdBy === identity.id);
  }, [rows, showAll, identity.id]);

  const hiddenCount = rows ? rows.length - visible.length : 0;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Properties</h1>
        </div>
        <IdentityChip className="mt-1" />
      </div>
      <p className="mt-2 text-sm text-zinc-400">{ROLE_BLURB[identity.role]}</p>

      <form onSubmit={createProperty} className="mt-8 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-500">New property</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="5614 Beacon St"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-emerald-400"
          required
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Property["kind"])}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none"
        >
          <option value="lease">lease</option>
          <option value="sublet">sublet</option>
          <option value="stay">stay</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-zinc-100 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add property"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      {rows === null ? (
        <div className="mt-8 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-400">No properties yet.</p>
          <p className="mt-1 text-xs text-zinc-500">Add one above, or open the scanner to see a sample report.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {visible.map(({ property, lastScannedAt, worstRatio, scanCount }) => (
            <li key={property.id}>
              <Link
                href={`/report/${property.id}`}
                className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-medium">{property.label}</p>
                      {property.isSample && (
                        <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                          Sample
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{property.kind}</p>
                  </div>
                  {scanCount > 0 && <p className="text-sm text-emerald-300">{(worstRatio * 100).toFixed(1)}%</p>}
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  {scanCount} scan{scanCount === 1 ? "" : "s"}
                  {lastScannedAt ? ` · last ${new Date(lastScannedAt).toLocaleString()}` : " · never scanned"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 w-full text-center text-xs text-zinc-500 underline underline-offset-4"
        >
          Show {hiddenCount} more from other people testing this
        </button>
      )}
      {showAll && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-4 w-full text-center text-xs text-zinc-500 underline underline-offset-4"
        >
          Show only mine
        </button>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link
            href="/scan"
            className="block rounded-full bg-emerald-400 py-4 text-center text-sm font-semibold text-black"
          >
            Open scanner
          </Link>
        </div>
      </div>
    </main>
  );
}
