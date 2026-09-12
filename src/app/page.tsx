"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CityContextCard } from "@/components/CityContextCard";
import { IdentityChip } from "@/components/IdentityChip";
import { useIdentity } from "@/lib/IdentityContext";
import { ROLE_BLURB } from "@/lib/identity";
import {
  PROPERTY_KINDS,
  kindLabel,
  lastFrameFlaggedCopy,
  severityFromRatio,
  severityTextClass,
} from "@/lib/labels";
import type { Property } from "@/lib/types";

const DEMO_PROPERTY_ID = "prop_sample_beacon";

function isDemoHouse(property: Property) {
  return Boolean(property.isSample) || property.id === DEMO_PROPERTY_ID;
}

type Summary = {
  property: Property;
  lastScannedAt: string | null;
  lastRatio: number | null;
  worsening: boolean;
  scanCount: number;
};

export default function HomePage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [showAll, setShowAll] = useState(false);
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
      const newest = scans[0];
      const oldest = scans[scans.length - 1];
      const lastRatio = newest?.totalAffectedRatio ?? null;
      const worsening =
        scans.length >= 2 &&
        newest != null &&
        oldest != null &&
        newest.totalAffectedRatio - oldest.totalAffectedRatio >= 0.01;
      summaries.push({
        property,
        lastScannedAt: newest?.capturedAt ?? null,
        lastRatio,
        worsening,
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
        body: JSON.stringify({
          label,
          kind,
          unit: unit.trim() || undefined,
          createdBy: identity.id,
          createdByName: identity.name,
        }),
      });
      const data = (await res.json()) as { property?: Property; reused?: boolean; error?: string };
      if (!res.ok || !data.property) throw new Error(data.error ?? "create failed");
      setLabel("");
      setUnit("");
      router.push(`/scan?propertyId=${data.property.id}`);
    } catch {
      setError("Could not create property");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    if (showAll) return rows;
    return rows.filter((r) => isDemoHouse(r.property) || r.property.createdBy === identity.id);
  }, [rows, showAll, identity.id]);

  const hiddenCount = rows ? rows.length - visible.length : 0;
  const walkProperty = visible.find((row) => !isDemoHouse(row.property))?.property;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Move-in check</h1>
        </div>
        <IdentityChip className="mt-1" />
      </div>
      <p className="mt-2 text-sm text-zinc-400">{ROLE_BLURB[identity.role]}</p>
      <p className="mt-2 text-sm text-zinc-500">
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
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Property type">
          {PROPERTY_KINDS.map((item) => {
            const selected = kind === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setKind(item.value)}
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-xl border border-emerald-400 bg-emerald-400/10 py-3 text-sm font-medium text-emerald-300"
                    : "rounded-xl border border-zinc-700 bg-zinc-950 py-3 text-sm text-zinc-300"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-zinc-100 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Opening house…" : "Set up this house"}
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
          {visible.map(({ property, lastScannedAt, lastRatio, worsening, scanCount }) => {
            const severity = severityFromRatio(lastRatio, worsening);
            return (
              <li key={property.id}>
                <div
                  className={`rounded-2xl border bg-zinc-900 ${
                    isDemoHouse(property) ? "border-violet-400/40" : "border-zinc-800"
                  }`}
                >
                  <Link href={`/report/${property.id}`} className="block p-4 transition hover:border-zinc-600">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-medium">{property.label}</p>
                          {isDemoHouse(property) && (
                            <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                              Demo report
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {isDemoHouse(property)
                            ? "Look only — not a house you photograph"
                            : `${kindLabel(property.kind)}${property.unit ? ` · Apt ${property.unit}` : ""}`}
                        </p>
                      </div>
                      {!isDemoHouse(property) && (
                        <p className={`max-w-[46%] text-right text-xs leading-snug ${severityTextClass(severity)}`}>
                          {lastFrameFlaggedCopy(lastRatio)}
                        </p>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">
                      {scanCount} {scanCount === 1 ? "photo" : "photos"}
                      {lastScannedAt ? ` · last ${new Date(lastScannedAt).toLocaleString()}` : " · no photos yet"}
                    </p>
                    {!isDemoHouse(property) && <CityContextCard context={property.cityContext} compact />}
                  </Link>
                  {!isDemoHouse(property) && (
                    <div className="px-4 pb-4">
                      <Link
                        href={`/scan?propertyId=${property.id}`}
                        className="block rounded-full bg-emerald-400 py-2.5 text-center text-xs font-semibold text-black"
                      >
                        Continue walkthrough
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
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
            href={walkProperty ? `/scan?propertyId=${walkProperty.id}` : "/scan"}
            className="block rounded-full bg-emerald-400 py-4 text-center text-sm font-semibold text-black"
          >
            {walkProperty ? "Continue walkthrough" : "Open camera"}
          </Link>
        </div>
      </div>
    </main>
  );
}
