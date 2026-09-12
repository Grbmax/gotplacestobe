"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HouseDashboard } from "@/components/HouseDashboard";
import { CompareView } from "@/components/CompareView";
import { DetectorBadge } from "@/components/DetectorBadge";
import { EvidencePrint } from "@/components/EvidencePrint";
import { ScanCard } from "@/components/ScanCard";
import { Timeline } from "@/components/Timeline";
import { civicAlong, surfaceTrend } from "@/lib/progression";
import type { Property, Review, Scan } from "@/lib/types";

type Group = {
  key: string;
  room: string;
  surface: string;
  scans: Scan[];
};

export default function ReportPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const [property, setProperty] = useState<Property | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [role, setRole] = useState<Review["reviewerRole"]>("tenant");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`, { cache: "no-store" }),
      fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
    ]);
    const pData = (await pRes.json()) as { property?: Property };
    let next = pData.property ?? null;
    if (next && (!next.cityContext || !next.cityContext.areaLead || !next.cityContext.civic || !next.cityContext.leadLine)) {
      const refresh = await fetch(`/api/properties/${propertyId}`, { method: "POST" });
      const rData = (await refresh.json()) as { property?: Property };
      next = rData.property ?? next;
    }
    const sData = (await sRes.json()) as { scans: Scan[] };
    setProperty(next);
    setScans(sData.scans ?? []);
  }, [propertyId]);

  useEffect(() => {
    void load().catch(() => setError("Could not load report"));
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of scans) {
      const key = `${s.room}::${s.surface}`;
      const g = map.get(key);
      if (!g) map.set(key, { key, room: s.room, surface: s.surface, scans: [s] });
      else g.scans.push(s);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [scans]);

  async function review(scanId: string, verdict: Review["verdict"]) {
    const res = await fetch(`/api/scans/${scanId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, reviewerRole: role }),
    });
    if (!res.ok) {
      setError("Review failed");
      return;
    }
    await load();
  }

  async function removePhoto(scanId: string) {
    const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not remove photo");
      return;
    }
    await load();
  }

  function exportPdf() {
    window.print();
  }

  if (!property && !error) {
    return <main className="grid min-h-dvh place-items-center text-zinc-400">Loading report…</main>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-16 pt-8 text-white">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-xs uppercase tracking-[0.2em] text-emerald-400">
          SCAN
        </Link>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200"
          >
            Export Legal Evidence PDF
          </button>
          <Link href="/scan" className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black">
            Add photos
          </Link>
        </div>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{property?.label ?? "Unknown"}</h1>
      <p className="mt-1 text-sm text-zinc-400">{property?.kind} · {scans.length} move-in photos</p>

      {property && <HouseDashboard context={property.cityContext} scans={scans} />}

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
        <span>Review as</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Review["reviewerRole"])}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1"
        >
          <option value="tenant">tenant</option>
          <option value="owner">owner</option>
          <option value="inspector">inspector</option>
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Photos in this report</p>

      <div className="mt-3 space-y-10">
        {groups.map((g) => {
          const trend = surfaceTrend(g.scans);
          const badge =
            trend.direction === "worsening"
              ? "bg-rose-500/20 text-rose-300"
              : trend.direction === "improving"
                ? "bg-emerald-500/20 text-emerald-300"
                : trend.direction === "stable"
                  ? "bg-zinc-500/20 text-zinc-300"
                  : "bg-zinc-700/40 text-zinc-400";
          const badgeLabel =
            trend.direction === "worsening"
              ? "Worsening — Landlord Inaction"
              : trend.direction.replace(/_/g, " ");
          return (
            <section key={g.key}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {g.room} · {g.surface.replace(/_/g, " ")}
                </h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${badge}`}>
                  {badgeLabel}
                </span>
              </div>

              <div className="mt-3">
                <Timeline
                  points={trend.points}
                  civic={civicAlong(trend.points, property?.cityContext?.civic?.monthly)}
                  direction={trend.direction}
                />
              </div>

              {trend.first && trend.latest && trend.first.id !== trend.latest.id && (
                <div className="mt-3">
                  <CompareView first={trend.first} latest={trend.latest} deltaRatio={trend.deltaRatio} />
                </div>
              )}

              <ul className="mt-4 space-y-3">
                {g.scans
                  .slice()
                  .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
                  .map((scan) => (
                    <li key={scan.id} className="space-y-2">
                      <ScanCard scan={scan} onDelete={() => void removePhoto(scan.id)} />
                      {!scan.review ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                          <p className="text-xs text-amber-200">Unreviewed — not a claim.</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "confirmed")}
                              className="flex-1 rounded-full bg-emerald-400 py-2 text-xs font-semibold text-black"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "disputed")}
                              className="flex-1 rounded-full border border-zinc-600 py-2 text-xs"
                            >
                              Dispute
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="px-1 text-xs text-zinc-500">
                          {scan.review.verdict} by {scan.review.reviewerRole} ·{" "}
                          <DetectorBadge detector={scan.detector} sample={scan.isSample} />
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>

      {property && <EvidencePrint property={property} scans={scans} role={role} />}
    </main>
  );
}
