"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Property } from "@/lib/scan/types";

type Summary = {
  property: Property;
  lastScannedAt: string | null;
  worstRatio: number;
  scanCount: number;
};

export default function InspectHomePage() {
  const [rows, setRows] = useState<Summary[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Property["kind"]>("stay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/properties", { cache: "no-store" });
    const data = (await res.json()) as { properties: Property[] };
    const summaries: Summary[] = [];
    for (const property of data.properties) {
      const sRes = await fetch(`/api/scans?propertyId=${property.id}`, { cache: "no-store" });
      const sData = (await sRes.json()) as {
        scans: { capturedAt: string; totalAffectedRatio: number }[];
      };
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
    void load().catch(() => setError("Could not load stays"));
  }, []);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind }),
      });
      if (!res.ok) throw new Error("create failed");
      setLabel("");
      await load();
    } catch {
      setError("Could not add stay");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto min-h-dvh max-w-md bg-paper px-5 pb-28 pt-8 text-ink">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-40" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <Link href="/map" className="text-xs uppercase tracking-[0.22em] text-ink/45">
            ← Quest
          </Link>
          <p className="text-[11px] uppercase tracking-[0.28em] text-moss">Inspect</p>
        </div>

        <h1 className="serif mt-4 text-4xl leading-none">Scan a stay</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">
          Document mold, seepage, cracks, and peeling paint before you move in — or before you
          hand the keys back.
        </p>

        <form
          onSubmit={createProperty}
          className="mt-8 space-y-3 border-t border-ink/10 pt-6"
        >
          <label className="block text-[11px] uppercase tracking-[0.18em] text-ink/45">
            Add a place
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="5614 Beacon St"
            className="w-full rounded-2xl border border-ink/15 bg-white/70 px-4 py-3 text-sm outline-none focus:border-moss"
            required
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Property["kind"])}
            className="w-full rounded-2xl border border-ink/15 bg-white/70 px-4 py-3 text-sm outline-none"
          >
            <option value="stay">stay</option>
            <option value="lease">lease</option>
            <option value="sublet">sublet</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-leaf disabled:opacity-50"
          >
            {busy ? "Adding…" : "Save place"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-urgent">{error}</p>}

        <ul className="mt-8 space-y-3">
          {rows.map(({ property, lastScannedAt, worstRatio, scanCount }) => (
            <li key={property.id}>
              <Link
                href={`/inspect/${property.id}`}
                className="block rounded-2xl border border-ink/10 bg-white/60 p-4 transition hover:border-moss/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium">{property.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink/45">
                      {property.kind}
                    </p>
                  </div>
                  <p className="text-sm text-moss">{(worstRatio * 100).toFixed(1)}%</p>
                </div>
                <p className="mt-3 text-xs text-ink/50">
                  {scanCount} scan{scanCount === 1 ? "" : "s"}
                  {lastScannedAt
                    ? ` · last ${new Date(lastScannedAt).toLocaleString()}`
                    : " · never scanned"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link
            href="/inspect/scan"
            className="block rounded-full bg-leaf py-4 text-center text-sm font-semibold text-ink"
          >
            Open scanner
          </Link>
        </div>
      </div>
    </main>
  );
}
