"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { HouseSelect } from "@/components/HouseSelect";
import { IdentityChip } from "@/components/IdentityChip";
import { OptimizeChart } from "@/components/OptimizeChart";
import { rememberHouse } from "@/lib/activeHouse";
import { roomSurfaceLabel } from "@/lib/labels";
import { coverageFromScans, nextBestSurface } from "@/lib/nextbest";
import { cumulativeDefects, guidedOrder, guidedVsNaiveSummary, naiveOrder, totalDistinctDefects } from "@/lib/optimize";
import type { Property, Scan } from "@/lib/types";

export default function OptimizePage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const [property, setProperty] = useState<Property | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [showNaive, setShowNaive] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    setStatus("loading");
    void (async () => {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`, { cache: "no-store" }),
        fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
      ]);
      const pData = (await pRes.json()) as { property?: Property };
      const sData = (await sRes.json()) as { scans: Scan[] };
      if (!pRes.ok || !pData.property) {
        setProperty(null);
        setStatus("missing");
        return;
      }
      setProperty(pData.property);
      setScans(sData.scans ?? []);
      rememberHouse(propertyId);
      setStatus("ready");
    })().catch(() => setStatus("missing"));
  }, [propertyId]);

  const { guidedCum, naiveCum, total, summary, nextShot } = useMemo(() => {
    const next = nextBestSurface(coverageFromScans(scans), property?.cityContext?.civic);
    return {
      guidedCum: cumulativeDefects(guidedOrder(scans)),
      naiveCum: cumulativeDefects(naiveOrder(scans)),
      total: totalDistinctDefects(scans),
      summary: guidedVsNaiveSummary(scans),
      nextShot: roomSurfaceLabel(next.room, next.surface),
    };
  }, [scans, property]);

  if (status === "loading") {
    return <main className="grid min-h-dvh place-items-center text-sm text-slate-500">Loading…</main>;
  }

  if (status === "missing" || !property) {
    return <HouseSelect intent="proof" />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/optimize">Change house</BackLink>
        <IdentityChip />
      </div>

      <p className="mt-4 text-[11px] font-medium tracking-[0.12em] text-emerald-700">Proof</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Guided vs. naive</h1>
      <p className="mt-1 text-sm text-slate-500">
        {property.label} · {scans.length} photos. Same photos, two orders: the planner versus wandering.
      </p>
      <Link href={`/report/${propertyId}`} className="mt-2 inline-block text-xs text-emerald-800 underline underline-offset-4">
        Open this house’s report
      </Link>

      {scans.length < 3 || total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm text-slate-500">Not enough scans yet to prove the claim.</p>
          <p className="mt-2 text-sm text-slate-800">Photograph the {nextShot} next.</p>
          <p className="mt-2 text-xs text-slate-500">
            Take a few photos across different surfaces — some with real findings — to compare guided vs. naive.
          </p>
          <Link
            href={`/scan?propertyId=${propertyId}`}
            className="mt-5 inline-block rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Take that photo
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <OptimizeChart guided={guidedCum} naive={naiveCum} showNaive={showNaive} />
          </div>

          <button
            type="button"
            onClick={() => setShowNaive((v) => !v)}
            className="mt-3 w-full rounded-full border border-slate-300 py-2.5 text-xs text-slate-600"
          >
            {showNaive ? "Hide naive line" : "Show naive line"}
          </button>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm leading-relaxed text-emerald-950">{summary?.sentence}</p>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Guided order re-runs the real next-best-capture planner over these same photos, step by step, as if you&apos;d
            followed it from the start. Naive photographs lowest-risk surfaces first — the opposite of the planner. Same
            photos, same defects — only the order changes.
          </p>
        </>
      )}
    </main>
  );
}
