"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddHouseSheet } from "@/components/AddHouseSheet";
import { CityContextCard } from "@/components/CityContextCard";
import { IdentityChip } from "@/components/IdentityChip";
import { useIdentity } from "@/lib/IdentityContext";
import { ROLE_BLURB } from "@/lib/identity";
import {
  kindLabel,
  lastFrameFlaggedCopy,
  severityFromRatio,
  severityTextClass,
} from "@/lib/labels";
import { formatScanTime } from "@/lib/time";
import { cityContextNeedsRefresh } from "@/lib/dashboard";
import { rememberHouse } from "@/lib/activeHouse";
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

type Filter = "mine" | "addresses" | "all";

function isStreetAddress(label: string) {
  return /^\d+\s+[A-Za-z]/.test(label.trim());
}

const HINT: Record<string, string> = {
  tenant: "Houses is the file. Scan and Report each ask which address first.",
  owner: "Tap a house to review it. Scan and Report still ask which address.",
  inspector: "Select a file here, or open Report and pick the address you are signing.",
};

export default function HomePage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [filter, setFilter] = useState<Filter>("addresses");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/properties", { cache: "no-store" });
    const data = (await res.json()) as { properties: Property[] };
    const properties = [...data.properties];
    for (const property of properties.slice(0, 8)) {
      if (!cityContextNeedsRefresh(property.cityContext)) continue;
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

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const mine = (r: Summary) => isDemoHouse(r.property) || r.property.createdBy === identity.id;
    const pool =
      filter === "mine"
        ? rows.filter(mine)
        : filter === "addresses"
          ? rows.filter((r) => mine(r) || isStreetAddress(r.property.label))
          : rows;
    const searched = q
      ? pool.filter(
          (r) =>
            r.property.label.toLowerCase().includes(q) ||
            (r.property.unit ?? "").toLowerCase().includes(q) ||
            (r.property.cityContext?.zipCode ?? "").includes(q),
        )
      : pool;
    return [...searched].sort((a, b) => {
      const rank = (r: Summary) => {
        let n = 0;
        if (r.property.createdBy === identity.id) n += 8;
        if (r.worsening) n += 4;
        if (r.scanCount > 0) n += 2;
        if (isStreetAddress(r.property.label)) n += 1;
        if (isDemoHouse(r.property)) n -= 6;
        return n;
      };
      const d = rank(b) - rank(a);
      if (d !== 0) return d;
      return a.property.label.localeCompare(b.property.label);
    });
  }, [rows, filter, query, identity.id]);

  useEffect(() => {
    if (!visible.length) {
      setActiveId(null);
      return;
    }
    setActiveId((cur) => {
      if (cur && visible.some((r) => r.property.id === cur)) return cur;
      return (
        visible.find((r) => r.property.createdBy === identity.id && !isDemoHouse(r.property))?.property.id ??
        visible.find((r) => !isDemoHouse(r.property))?.property.id ??
        visible[0]!.property.id
      );
    });
  }, [visible, identity.id]);

  useEffect(() => {
    if (!activeId) return;
    const row = visible.find((r) => r.property.id === activeId);
    if (row && !isDemoHouse(row.property)) rememberHouse(activeId);
  }, [activeId, visible]);

  const hiddenCount = rows ? rows.length - visible.length : 0;

  const filters: { id: Filter; label: string }[] = [
    { id: "addresses", label: "On file" },
    { id: "mine", label: "Mine" },
    { id: "all", label: "All" },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.12em] text-emerald-700">CribCheck</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Move-in check</h1>
        </div>
        <IdentityChip className="mt-1 shrink-0" />
      </div>
      <p className="mt-2 text-sm text-slate-500">{ROLE_BLURB[identity.role]}</p>
      <p className="mt-1 text-sm text-slate-500">{HINT[identity.role]}</p>

      <div className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="house-search">
          Search houses
        </label>
        <input
          id="house-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or ZIP"
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-600"
        />
        <button
          type="button"
          onClick={() => {
            setAdding(true);
          }}
          className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white"
        >
          + Add
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 rounded-full border border-slate-200 bg-white p-1 text-xs font-medium">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={
              filter === item.id ? "rounded-full bg-emerald-600 py-2 text-white" : "rounded-full py-2 text-slate-500"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {rows === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
            <p className="text-sm text-slate-700">No houses in this view.</p>
            <p className="mt-1 text-xs text-slate-500">
              {query ? "Clear search, or add this address." : "Add a rental address to start the walkthrough."}
            </p>
            <button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
              className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Add a house
            </button>
          </div>
        ) : (
          visible.map((row) => (
            <HouseCard
              key={row.property.id}
              row={row}
              selected={row.property.id === activeId}
              onSelect={() => setActiveId(row.property.id)}
            />
          ))
        )}
      </div>

      {hiddenCount > 0 && filter !== "all" && !query && (
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="mt-4 w-full text-center text-xs text-slate-500 underline underline-offset-4"
        >
          Show {hiddenCount} more, including test names
        </button>
      )}
      {filter === "all" && (
        <button
          type="button"
          onClick={() => setFilter("addresses")}
          className="mt-4 w-full text-center text-xs text-slate-500 underline underline-offset-4"
        >
          Hide test names
        </button>
      )}

      <AddHouseSheet
        open={adding}
        initialLabel={query.trim()}
        onClose={() => setAdding(false)}
        onCreated={(property) => {
          setAdding(false);
          rememberHouse(property.id);
          router.push(`/scan?propertyId=${property.id}`);
        }}
      />
    </main>
  );
}

function HouseCard({
  row,
  selected,
  onSelect,
}: {
  row: Summary;
  selected?: boolean;
  onSelect: () => void;
}) {
  const { property, lastScannedAt, lastRatio, worsening, scanCount } = row;
  const severity = severityFromRatio(lastRatio, worsening);
  const scanHref = `/scan?propertyId=${property.id}`;
  const reportHref = `/report/${property.id}`;
  const demo = isDemoHouse(property);

  return (
    <section
      className={`rounded-2xl border bg-white p-4 ${
        selected ? "border-emerald-600 shadow-[0_0_0_1px_rgba(5,150,105,0.25)]" : demo ? "border-sky-300" : "border-slate-200"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={selected}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {selected && (
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">Selected</p>
            )}
            <div className={`flex flex-wrap items-center gap-2 ${selected ? "mt-0.5" : ""}`}>
              <h2 className="text-lg font-medium leading-snug">{property.label}</h2>
              {demo && (
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Demo
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {demo ? "Sample report — read-only" : `${kindLabel(property.kind)}${property.unit ? ` · Apt ${property.unit}` : ""}`}
            </p>
          </div>
          <div className="flex max-w-[44%] flex-col items-end gap-1">
            {worsening && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">
                Worsening
              </span>
            )}
            {!demo && (
              <p className={`text-right text-xs leading-snug ${severityTextClass(severity)}`}>
                {lastFrameFlaggedCopy(lastRatio)}
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {scanCount} {scanCount === 1 ? "photo" : "photos"}
          {(property.walks?.length ?? 0) > 1 ? ` · ${property.walks!.length} records` : ""}
          {lastScannedAt ? ` · ${formatScanTime(lastScannedAt)}` : " · no photos yet"}
        </p>
      </button>
      {!demo && <CityContextCard context={property.cityContext} compact />}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={reportHref}
          onClick={onSelect}
          className="rounded-full border border-slate-300 py-2.5 text-center text-xs"
        >
          Open report
        </Link>
        {!demo ? (
          <Link
            href={scanHref}
            onClick={onSelect}
            className="rounded-full bg-emerald-600 py-2.5 text-center text-xs font-semibold text-white"
          >
            {scanCount ? "Continue scan" : "Start scan"}
          </Link>
        ) : (
          <Link
            href={reportHref}
            className="rounded-full border border-slate-200 py-2.5 text-center text-xs text-slate-500"
          >
            View demo
          </Link>
        )}
      </div>
    </section>
  );
}
