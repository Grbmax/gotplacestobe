"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompareView } from "@/components/CompareView";
import { DetectorBadge } from "@/components/DetectorBadge";
import { IdentityChip } from "@/components/IdentityChip";
import { ScanCard } from "@/components/ScanCard";
import { Timeline } from "@/components/Timeline";
import { ROLE_LABEL } from "@/lib/identity";
import { useIdentity } from "@/lib/IdentityContext";
import { surfaceTrend } from "@/lib/progression";
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
  const { identity } = useIdentity();
  const [property, setProperty] = useState<Property | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [reviewingAsSelf, setReviewingAsSelf] = useState(true);
  const [overrideRole, setOverrideRole] = useState<Review["reviewerRole"]>(identity.role);
  const role = reviewingAsSelf ? identity.role : overrideRole;
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
      body: JSON.stringify({
        verdict,
        reviewerRole: role,
        reviewerId: reviewingAsSelf ? identity.id : undefined,
        reviewerName: reviewingAsSelf ? identity.name : undefined,
      }),
    });
    if (!res.ok) {
      setError("Review failed");
      return;
    }
    await load();
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
        <div className="flex items-center gap-2">
          <IdentityChip />
          <Link href="/scan" className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black">
            New scan
          </Link>
        </div>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{property?.label ?? "Unknown"}</h1>
      <p className="mt-1 text-sm text-zinc-400">{property?.kind} · {scans.length} scans</p>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
        {reviewingAsSelf ? (
          <>
            <span>
              Reviewing as <span className="text-zinc-200">{identity.name}</span> ({ROLE_LABEL[identity.role]})
            </span>
            <button
              type="button"
              onClick={() => setReviewingAsSelf(false)}
              className="underline underline-offset-2 text-zinc-500"
            >
              not you?
            </button>
          </>
        ) : (
          <>
            <span>Reviewing as</span>
            <select
              value={overrideRole}
              onChange={(e) => setOverrideRole(e.target.value as Review["reviewerRole"])}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              <option value="tenant">{ROLE_LABEL.tenant}</option>
              <option value="owner">{ROLE_LABEL.owner}</option>
              <option value="inspector">{ROLE_LABEL.inspector}</option>
            </select>
            <button
              type="button"
              onClick={() => setReviewingAsSelf(true)}
              className="underline underline-offset-2 text-zinc-500"
            >
              use my role
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <div className="mt-8 space-y-10">
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
          return (
            <section key={g.key}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {g.room} · {g.surface.replace(/_/g, " ")}
                </h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${badge}`}>
                  {trend.direction.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-3">
                <Timeline points={trend.points} />
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
                      <ScanCard scan={scan} />
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
    </main>
  );
}
