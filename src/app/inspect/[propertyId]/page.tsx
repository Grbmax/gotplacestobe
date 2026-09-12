"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompareView } from "@/components/scan/CompareView";
import { DetectorBadge } from "@/components/scan/DetectorBadge";
import { ScanCard } from "@/components/scan/ScanCard";
import { Timeline } from "@/components/scan/Timeline";
import { surfaceTrend } from "@/lib/scan/progression";
import type { Property, Review, Scan } from "@/lib/scan/types";

type Group = {
  key: string;
  room: string;
  surface: string;
  scans: Scan[];
};

export default function InspectReportPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const [property, setProperty] = useState<Property | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [role, setRole] = useState<Review["reviewerRole"]>("tenant");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch("/api/properties", { cache: "no-store" }),
      fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
    ]);
    const pData = (await pRes.json()) as { properties: Property[] };
    const sData = (await sRes.json()) as { scans: Scan[] };
    setProperty(pData.properties.find((p) => p.id === propertyId) ?? null);
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

  if (!property && !error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper text-ink/45">Loading report…</main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-paper px-5 pb-16 pt-8 text-ink">
      <div className="flex items-center justify-between gap-3">
        <Link href="/inspect" className="text-xs uppercase tracking-[0.2em] text-moss">
          Inspect
        </Link>
        <Link
          href="/inspect/scan"
          className="rounded-full bg-leaf px-3 py-1.5 text-xs font-semibold text-ink"
        >
          New scan
        </Link>
      </div>

      <h1 className="serif mt-4 text-3xl leading-none">{property?.label ?? "Unknown"}</h1>
      <p className="mt-2 text-sm text-ink/55">
        {property?.kind} · {scans.length} scans
      </p>

      <div className="mt-4 flex items-center gap-2 text-xs text-ink/50">
        <span>Review as</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Review["reviewerRole"])}
          className="rounded-lg border border-ink/15 bg-white px-2 py-1"
        >
          <option value="tenant">tenant</option>
          <option value="owner">owner</option>
          <option value="inspector">inspector</option>
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-urgent">{error}</p>}

      <div className="mt-8 space-y-10">
        {groups.map((g) => {
          const trend = surfaceTrend(g.scans);
          const badge =
            trend.direction === "worsening"
              ? "bg-urgent/15 text-urgent"
              : trend.direction === "improving"
                ? "bg-live/30 text-moss"
                : trend.direction === "stable"
                  ? "bg-ink/5 text-ink/60"
                  : "bg-dust/40 text-ink/45";
          return (
            <section key={g.key}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {g.room} · {g.surface.replace(/_/g, " ")}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${badge}`}
                >
                  {trend.direction.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-3">
                <Timeline points={trend.points} />
              </div>

              {trend.first && trend.latest && trend.first.id !== trend.latest.id && (
                <div className="mt-3">
                  <CompareView
                    first={trend.first}
                    latest={trend.latest}
                    deltaRatio={trend.deltaRatio}
                  />
                </div>
              )}

              <ul className="mt-4 space-y-3">
                {g.scans
                  .slice()
                  .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
                  .map((scan) => (
                    <li key={scan.id} className="space-y-2">
                      <ScanCard scan={scan} />
                      {!scan.review ? (
                        <div className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
                          <p className="text-xs text-ink/70">Unreviewed — not a claim.</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "confirmed")}
                              className="flex-1 rounded-full bg-leaf py-2 text-xs font-semibold text-ink"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "disputed")}
                              className="flex-1 rounded-full border border-ink/20 py-2 text-xs"
                            >
                              Dispute
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="px-1 text-xs text-ink/45">
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

        {!groups.length && (
          <p className="text-sm text-ink/50">No scans yet. Open the scanner to capture a surface.</p>
        )}
      </div>
    </main>
  );
}
