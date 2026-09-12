"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { HouseSelect } from "@/components/HouseSelect";
import { HouseDashboard } from "@/components/HouseDashboard";
import { CompareView } from "@/components/CompareView";
import { DetectorBadge } from "@/components/DetectorBadge";
import { EvidencePrint } from "@/components/EvidencePrint";
import { IdentityChip } from "@/components/IdentityChip";
import { ScanCard } from "@/components/ScanCard";
import { Timeline } from "@/components/Timeline";
import { useIdentity } from "@/lib/IdentityContext";
import { ROLE_LABEL } from "@/lib/identity";
import {
  REVIEW_ROLES,
  kindLabel,
  roleLabel,
  roomSurfaceLabel,
  trendLabel,
  verdictLabel,
} from "@/lib/labels";
import { cityContextNeedsRefresh } from "@/lib/dashboard";
import { rememberHouse } from "@/lib/activeHouse";
import { guidedVsNaiveSummary, totalDistinctDefects } from "@/lib/optimize";
import { civicAlong, surfaceTrend } from "@/lib/progression";
import { scansForWalk, walkKindLabel, walksChronological } from "@/lib/walks";
import type { Property, Review, Scan } from "@/lib/types";

type Group = {
  key: string;
  room: string;
  surface: string;
  scans: Scan[];
};

function isModelScan(scan: Scan) {
  return scan.detector !== "mock";
}

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
  const [modelOnly, setModelOnly] = useState(true);
  const [walkFilter, setWalkFilter] = useState<string>("all");
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`, { cache: "no-store" }),
      fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
    ]);
    const pData = (await pRes.json()) as { property?: Property };
    let next = pData.property ?? null;
    if (!pRes.ok || !next) {
      setProperty(null);
      setScans([]);
      setStatus("missing");
      return;
    }
    if (cityContextNeedsRefresh(next.cityContext)) {
      const refresh = await fetch(`/api/properties/${propertyId}`, { method: "POST" });
      const rData = (await refresh.json()) as { property?: Property };
      next = rData.property ?? next;
    }
    const sData = (await sRes.json()) as { scans: Scan[] };
    setProperty(next);
    setScans(sData.scans ?? []);
    rememberHouse(propertyId);
    const walks = next.walks ?? [];
    const latest = walksChronological(walks).at(-1);
    setWalkFilter((cur) => {
      if (cur === "all") return "all";
      if (walks.some((w) => w.id === cur)) return cur;
      return latest?.id ?? "all";
    });
    setStatus("ready");
  }, [propertyId]);

  useEffect(() => {
    setStatus("loading");
    void load().catch(() => {
      setError("Could not load report");
      setStatus("missing");
    });
  }, [load]);

  const tenureScans = useMemo(
    () => scansForWalk(scans, walkFilter === "all" ? "all" : walkFilter),
    [scans, walkFilter],
  );

  const visibleScans = useMemo(
    () => (modelOnly ? tenureScans.filter(isModelScan) : tenureScans),
    [tenureScans, modelOnly],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of visibleScans) {
      const key = `${s.room}::${s.surface}`;
      const g = map.get(key);
      if (!g) map.set(key, { key, room: s.room, surface: s.surface, scans: [s] });
      else g.scans.push(s);
    }
    const directionRank: Record<string, number> = { worsening: 0, insufficient_data: 1, stable: 2, improving: 3 };
    return [...map.values()].sort((a, b) => {
      const ta = surfaceTrend(a.scans);
      const tb = surfaceTrend(b.scans);
      const rankDiff = directionRank[ta.direction] - directionRank[tb.direction];
      if (rankDiff !== 0) return rankDiff;
      const peakA = Math.max(0, ...a.scans.map((s) => s.totalAffectedRatio));
      const peakB = Math.max(0, ...b.scans.map((s) => s.totalAffectedRatio));
      return peakB - peakA;
    });
  }, [visibleScans]);

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

  if (status === "loading") {
    return <main className="grid min-h-dvh place-items-center text-slate-500">Loading report…</main>;
  }

  if (status === "missing" || !property) {
    return <HouseSelect intent="report" />;
  }

  const photoCount = visibleScans.length;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/report">Change house</BackLink>
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <IdentityChip />
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-full border border-emerald-600/40 px-3 py-1.5 text-xs text-emerald-800"
          >
            Export PDF
          </button>
        </div>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{property?.label ?? "Unknown"}</h1>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {property ? kindLabel(property.kind) : ""}
          {property?.unit ? ` · Apt ${property.unit}` : ""}
          {property ? " · " : ""}
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
          {walkFilter !== "all" ? ` · ${walkKindLabel((property?.walks ?? []).find((w) => w.id === walkFilter)?.kind ?? "move_in")}` : " · full tenure"}
        </p>
      </div>

      {(property?.walks?.length ?? 0) > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto print:hidden">
          <button
            type="button"
            onClick={() => setWalkFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              walkFilter === "all" ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            All records
          </button>
          {walksChronological(property?.walks ?? []).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWalkFilter(w.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                walkFilter === w.id ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {walkKindLabel(w.kind)}
            </button>
          ))}
        </div>
      )}

      <Link
        href={`/scan?propertyId=${propertyId}`}
        className="mt-5 block rounded-full bg-emerald-600 py-4 text-center text-lg font-semibold text-white print:hidden"
      >
        Add photo
      </Link>

      {(() => {
        const summary = guidedVsNaiveSummary(scans);
        if (summary) {
          return (
            <Link
              href={`/optimize/${propertyId}`}
              className="mt-4 block rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Guided vs. naive</p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-950">{summary.sentence}</p>
              <p className="mt-2 text-xs text-emerald-700">See the chart →</p>
            </Link>
          );
        }
        const total = totalDistinctDefects(scans);
        const hint =
          scans.length < 3
            ? `Take ${3 - scans.length} more photo${3 - scans.length === 1 ? "" : "s"} to unlock this`
            : total === 0
              ? "No defects found across your scans yet — nothing to compare"
              : "Not enough data yet";
        return (
          <Link
            href={`/optimize/${propertyId}`}
            className="mt-4 block rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Guided vs. naive</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{hint}</p>
          </Link>
        );
      })()}

      {property && (
        <HouseDashboard context={property.cityContext} scans={scans} addressLabel={property.label} />
      )}

      <div className="mt-4 text-xs text-slate-500">
        {reviewingAsSelf ? (
          <div className="flex items-center gap-2">
            <span>
              Reviewing as <span className="text-slate-800">{identity.name}</span> ({ROLE_LABEL[identity.role]})
            </span>
            <button
              type="button"
              onClick={() => setReviewingAsSelf(false)}
              className="underline underline-offset-2 text-slate-400"
            >
              not you?
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-500">Review as</p>
              <button
                type="button"
                onClick={() => setReviewingAsSelf(true)}
                className="underline underline-offset-2 text-slate-400"
              >
                use my role
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Reviewer role">
              {REVIEW_ROLES.map((item) => {
                const selected = overrideRole === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setOverrideRole(item.value)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "rounded-xl border border-emerald-600 bg-emerald-50 py-2 text-xs font-medium text-emerald-800"
                        : "rounded-xl border border-slate-200 bg-white py-2 text-xs text-slate-600"
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Surfaces</p>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={modelOnly}
            onChange={(e) => setModelOnly(e.target.checked)}
            className="accent-emerald-600"
          />
          Model detections only
        </label>
      </div>

      <div className="mt-3 space-y-10">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium">
              {modelOnly && scans.length > 0
                ? "No model detections in this report"
                : "Scan a surface to start the report"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {modelOnly && scans.length > 0
                ? "Turn off the filter to see frames where no model ran."
                : "Point the camera at paint, vents, and wet spots. County lead and housing records stay in the banner above."}
            </p>
          </div>
        )}
        {groups.map((g) => {
          const trend = surfaceTrend(g.scans);
          const badge =
            trend.direction === "worsening"
              ? "bg-rose-100 text-rose-700"
              : trend.direction === "improving"
                ? "bg-emerald-100 text-emerald-700"
                : trend.direction === "stable"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-slate-100 text-slate-500";
          const badgeLabel =
            trend.direction === "worsening" ? "Worsening — Landlord Inaction" : trendLabel(trend.direction);
          return (
            <section key={g.key}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{roomSurfaceLabel(g.room, g.surface)}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide ${badge}`}>
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
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-xs text-amber-900">Unreviewed — not a claim.</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "confirmed")}
                              className="min-h-11 flex-1 rounded-full bg-emerald-600 py-2 text-xs font-semibold text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => void review(scan.id, "disputed")}
                              className="min-h-11 flex-1 rounded-full border border-slate-300 py-2 text-xs"
                            >
                              Dispute
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="px-1 text-xs text-slate-500">
                          {verdictLabel(scan.review.verdict)} by{" "}
                          {scan.review.reviewerName ?? roleLabel(scan.review.reviewerRole)} ·{" "}
                          <DetectorBadge detector={scan.detector} sample={scan.isSample} degraded={scan.degraded} />
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>

      {property && <EvidencePrint property={property} scans={tenureScans} role={role} />}
    </main>
  );
}
