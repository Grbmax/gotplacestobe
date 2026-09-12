"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IdentityChip } from "@/components/IdentityChip";
import { OptimizeChart } from "@/components/OptimizeChart";
import { cumulativeDefects, guidedOrder, naiveOrder, photosToReach, totalDistinctDefects } from "@/lib/optimize";
import type { Property, Scan } from "@/lib/types";

export default function OptimizePage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const [property, setProperty] = useState<Property | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [showNaive, setShowNaive] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/properties", { cache: "no-store" }),
        fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
      ]);
      const pData = (await pRes.json()) as { properties: Property[] };
      const sData = (await sRes.json()) as { scans: Scan[] };
      setProperty(pData.properties.find((p) => p.id === propertyId) ?? null);
      setScans(sData.scans ?? []);
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, [propertyId]);

  const { guidedCum, naiveCum, total, guidedAt80, naiveAt80 } = useMemo(() => {
    const total = totalDistinctDefects(scans);
    const target = Math.max(1, Math.ceil(total * 0.8));
    const guidedCum = cumulativeDefects(guidedOrder(scans));
    const naiveCum = cumulativeDefects(naiveOrder(scans));
    return {
      guidedCum,
      naiveCum,
      total,
      guidedAt80: photosToReach(guidedCum, target),
      naiveAt80: photosToReach(naiveCum, target),
    };
  }, [scans]);

  if (!loaded) {
    return <main className="grid min-h-dvh place-items-center text-sm text-zinc-500">Loading…</main>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-16 pt-8 text-white">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/report/${propertyId}`} className="text-xs uppercase tracking-[0.2em] text-emerald-400">
          ← Report
        </Link>
        <IdentityChip />
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Guided vs. naive</h1>
      <p className="mt-1 text-sm text-zinc-400">{property?.label ?? "This property"} · {scans.length} photos</p>

      {scans.length < 3 || total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-400">Not enough scans yet.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Take at least a few photos across different surfaces — some with real findings — to compare orderings.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <OptimizeChart guided={guidedCum} naive={naiveCum} showNaive={showNaive} />
          </div>

          <button
            type="button"
            onClick={() => setShowNaive((v) => !v)}
            className="mt-3 w-full rounded-full border border-zinc-700 py-2.5 text-xs text-zinc-300"
          >
            {showNaive ? "Hide naive line" : "Show naive line"}
          </button>

          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <p className="text-sm leading-relaxed text-emerald-100">
              Guided capture found {Math.min(total, Math.ceil(total * 0.8))} of {total} defects in{" "}
              <span className="font-semibold">{guidedAt80}</span> photo{guidedAt80 === 1 ? "" : "s"}. Photographing
              in the order they were actually taken took{" "}
              <span className="font-semibold">{naiveAt80}</span> photo{naiveAt80 === 1 ? "" : "s"} to find the same.
            </p>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Guided order re-runs the real next-best-capture planner over these same photos, step by step, as if you&apos;d
            followed it from the start. Naive is the order they were actually captured in. Same photos, same defects
            — only the order changes.
          </p>
        </>
      )}
    </main>
  );
}
