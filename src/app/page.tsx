"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CityContextCard } from "@/components/CityContextCard";
import type { Property } from "@/lib/types";

type Summary = {
  property: Property;
  lastScannedAt: string | null;
  worstRatio: number;
  scanCount: number;
};

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Summary[]>([]);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [kind, setKind] = useState<Property["kind"]>("lease");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/properties", { cache: "no-store" });
    const data = (await res.json()) as { properties: Property[] };
    const properties = [...data.properties];
    for (const property of properties.slice(0, 8)) {
      if (property.cityContext?.areaLead) continue;
      const refreshed = await fetch(`/api/properties/${property.id}`, { method: "POST" });
      if (!refreshed.ok) continue;
      const body = (await refreshed.json()) as { property?: Property };
      if (body.property) {
        const i = properties.findIndex((p) => p.id === property.id);
        if (i >= 0) properties[i] = body.property;
      }
    }
    const summaries: Summary[] = [];
    for (const property of properties) {
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
  }, []);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind, unit: unit.trim() || undefined }),
      });
      const data = (await res.json()) as { property?: Property; reused?: boolean; error?: string };
      if (!res.ok || !data.property) throw new Error(data.error ?? "create failed");
      setLabel("");
      setUnit("");
      router.push(`/report/${data.property.id}`);
    } catch {
      setError("Could not create property");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-white">
      <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Move-in check</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Enter the rental once. Same street address reopens that house. Different apartments stay separate reports.
      </p>

      <form onSubmit={createProperty} className="mt-8 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-500">Rental address</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="5614 Beacon St"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-emerald-400"
          required
        />
        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-500">Apt / unit (if any)</label>
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="2B"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-emerald-400"
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
          {busy ? "Opening house…" : "Set up this house"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <ul className="mt-8 space-y-3">
        {rows.map(({ property, lastScannedAt, worstRatio, scanCount }) => (
          <li key={property.id}>
            <Link
              href={`/report/${property.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-medium">{property.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                    {property.kind}
                    {property.unit ? ` · apt ${property.unit}` : ""}
                  </p>
                </div>
                <p className="text-sm text-emerald-300">{(worstRatio * 100).toFixed(1)}%</p>
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                {scanCount} photo{scanCount === 1 ? "" : "s"}
                {lastScannedAt ? ` · last ${new Date(lastScannedAt).toLocaleString()}` : " · no photos yet"}
              </p>
              <CityContextCard context={property.cityContext} compact />
            </Link>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link
            href="/scan"
            className="block rounded-full bg-emerald-400 py-4 text-center text-sm font-semibold text-black"
          >
            Open camera
          </Link>
        </div>
      </div>
    </main>
  );
}
