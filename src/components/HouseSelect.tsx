"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddHouseSheet } from "@/components/AddHouseSheet";
import { lastHouse, rememberHouse } from "@/lib/activeHouse";
import { useIdentity } from "@/lib/IdentityContext";
import { kindLabel } from "@/lib/labels";
import { isLandlordPortfolio, propertiesForRole } from "@/lib/persona";
import type { Property } from "@/lib/types";

export type HouseSelectIntent = "scan" | "report" | "proof";

const COPY: Record<
  HouseSelectIntent,
  { kicker: string; title: string; blurb: string; lastLabel: string; href: (id: string) => string }
> = {
  scan: {
    kicker: "Scan",
    title: "Which house?",
    blurb:
      "Photos attach to one address. Pick a house on file, or add the rental you’re walking. Same street is one house — mid-stay and exit are new records, not new cards.",
    lastLabel: "Last walked",
    href: (id) => `/scan?propertyId=${id}`,
  },
  report: {
    kicker: "Report",
    title: "Which house?",
    blurb:
      "Open the file for one address — photos, county records, and move-in / mid-stay / exit packets. Export PDF compiles the walks you select.",
    lastLabel: "Last opened",
    href: (id) => `/report/${id}`,
  },
  proof: {
    kicker: "Proof",
    title: "Which house?",
    blurb:
      "Proof is the Optimization claim: the same photos, ordered by the next-best-surface planner versus wandering. Pick the house whose walkthrough you want to measure.",
    lastLabel: "Last opened",
    href: (id) => `/optimize/${id}`,
  },
};

function isStreetAddress(label: string) {
  return /^\d+\s+[A-Za-z]/.test(label.trim());
}

function isDemoHouse(property: Property) {
  return Boolean(property.isSample);
}

export function HouseSelect({
  intent,
  houses: housesProp,
  lastId: lastIdProp,
  onCreated,
}: {
  intent: HouseSelectIntent;
  houses?: Property[] | null;
  lastId?: string | null;
  onCreated?: (property: Property) => void;
}) {
  const router = useRouter();
  const { identity } = useIdentity();
  const copy = COPY[intent];
  const [loaded, setLoaded] = useState<Property[] | null>(housesProp ?? null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [remembered, setRemembered] = useState<string | null>(lastIdProp ?? null);

  useEffect(() => {
    if (housesProp) {
      setLoaded(housesProp);
      return;
    }
    void fetch("/api/properties", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { properties: Property[] }) => setLoaded(data.properties ?? []))
      .catch(() => setLoaded([]));
  }, [housesProp]);

  useEffect(() => {
    if (lastIdProp !== undefined) {
      setRemembered(lastIdProp);
      return;
    }
    setRemembered(lastHouse());
  }, [lastIdProp]);

  const houses = useMemo(() => {
    const list = propertiesForRole(loaded ?? [], identity.role);
    return intent === "scan" ? list.filter((p) => !isDemoHouse(p)) : list;
  }, [loaded, intent, identity.role]);

  const lastId = remembered;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? houses.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            (p.unit ?? "").toLowerCase().includes(q) ||
            (p.cityContext?.zipCode ?? "").includes(q),
        )
      : houses.filter((p) => p.id === lastId || isStreetAddress(p.label) || (intent !== "scan" && isDemoHouse(p)));
    return [...pool].sort((a, b) => {
      if (a.id === lastId) return -1;
      if (b.id === lastId) return 1;
      if (isDemoHouse(a) !== isDemoHouse(b)) return isDemoHouse(a) ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
  }, [houses, query, lastId, intent]);

  function goCreated(property: Property) {
    rememberHouse(property.id);
    if (onCreated) {
      onCreated(property);
      return;
    }
    router.push(`/scan?propertyId=${property.id}`);
  }

  if (loaded === null) {
    return <main className="grid min-h-dvh place-items-center text-sm text-slate-500">Loading houses…</main>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <p className="text-[11px] font-medium tracking-[0.12em] text-emerald-700">{copy.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{copy.blurb}</p>

      <div className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor={`${intent}-house-search`}>
          Search houses
        </label>
        <input
          id={`${intent}-house-search`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address"
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-600"
        />
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white"
        >
          + New
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
            <p className="text-sm text-slate-700">
              {houses.length === 0
                ? intent === "report"
                  ? "No reports to open yet."
                  : intent === "scan"
                    ? "No house to scan yet."
                    : "No houses on file yet."
                : "Nothing matches that search."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {houses.length === 0
                ? "Add an address first. You won’t be sent into another person’s file."
                : "Try a street name, or add this as a new house."}
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Add an address
            </button>
          </div>
        ) : (
          visible.map((property) => {
            const last = property.id === lastId;
            const demo = isDemoHouse(property);
            return (
              <Link
                key={property.id}
                href={copy.href(property.id)}
                onClick={() => rememberHouse(property.id)}
                className={`block w-full rounded-2xl border bg-white p-4 text-left ${
                  last ? "border-emerald-600" : demo ? "border-sky-300" : "border-slate-200"
                }`}
              >
                {last && (
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">{copy.lastLabel}</p>
                )}
                {isLandlordPortfolio(property) && (
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">Portfolio</p>
                )}
                <p className={`text-lg font-medium leading-snug ${last ? "mt-0.5" : ""}`}>{property.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {demo
                    ? "Sample report — read-only"
                    : isLandlordPortfolio(property)
                      ? `${property.cityContext?.neighborhood ?? "East End"} · ${kindLabel(property.kind)}`
                      : `${kindLabel(property.kind)}${property.unit ? ` · Apt ${property.unit}` : ""}`}
                </p>
              </Link>
            );
          })
        )}
      </div>

      <AddHouseSheet
        open={adding}
        initialLabel={query.trim()}
        onClose={() => setAdding(false)}
        onCreated={goCreated}
      />
    </main>
  );
}
