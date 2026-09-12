"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DetectorBadge } from "@/components/DetectorBadge";
import { SurfacePrompt } from "@/components/SurfacePrompt";
import { Viewfinder } from "@/components/Viewfinder";
import { KNOWN_SURFACES, nextBestSurface } from "@/lib/nextbest";
import { citationLines } from "@/lib/articleVi";
import type { Detection, Property, Scan, SurfaceCoverage } from "@/lib/types";

export default function ScanPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [room, setRoom] = useState("bathroom");
  const [surface, setSurface] = useState("ceiling_vent");
  const [reason, setReason] = useState("never scanned · high-risk surface");
  const [analyzing, setAnalyzing] = useState(false);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const [resultDets, setResultDets] = useState<Detection[] | null>(null);
  const [resultScan, setResultScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/properties", { cache: "no-store" });
      const data = (await res.json()) as { properties: Property[] };
      setProperties(data.properties);
      const first = data.properties[0];
      if (first) setPropertyId(first.id);
    })().catch(() => setError("Could not load properties"));
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    void (async () => {
      const res = await fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" });
      const data = (await res.json()) as { scans: Scan[] };
      const map = new Map<string, SurfaceCoverage>();
      for (const s of data.scans) {
        const key = `${s.room}::${s.surface}`;
        const cur = map.get(key);
        if (!cur) {
          map.set(key, { room: s.room, surface: s.surface, lastScannedAt: s.capturedAt, scanCount: 1 });
        } else {
          cur.scanCount += 1;
          if (s.capturedAt > (cur.lastScannedAt ?? "")) cur.lastScannedAt = s.capturedAt;
        }
      }
      const house = properties.find((p) => p.id === propertyId);
      const next = nextBestSurface([...map.values()], house?.cityContext?.civic);
      setRoom(next.room);
      setSurface(next.surface);
      setReason(next.reason);
    })().catch(() => undefined);
  }, [propertyId, properties]);

  const rooms = useMemo(() => [...new Set(KNOWN_SURFACES.map((s) => s.room))], []);
  const surfaces = useMemo(
    () => KNOWN_SURFACES.filter((s) => s.room === room).map((s) => s.surface),
    [room],
  );

  async function onCapture(dataUrl: string) {
    if (!propertyId) {
      setError("Create a property first");
      return;
    }
    setError(null);
    setFrozenUrl(dataUrl);
    setResultDets(null);
    setResultScan(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, room, surface, image: dataUrl }),
      });
      const data = (await res.json()) as { scan?: Scan; error?: string };
      if (!res.ok || !data.scan) throw new Error(data.error ?? "scan failed");
      setResultScan(data.scan);
      setResultDets(data.scan.detections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setFrozenUrl(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function resumeLive() {
    setFrozenUrl(null);
    setResultDets(null);
    setResultScan(null);
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <Viewfinder
          onCapture={onCapture}
          analyzing={analyzing}
          frozenUrl={frozenUrl}
          resultDetections={resultDets}
          resultDetector={resultScan?.detector ?? null}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-3 p-4">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <Link href="/" className="rounded-full bg-black/55 px-3 py-1.5 text-xs uppercase tracking-wider">
            SCAN
          </Link>
          {propertyId && (
            <Link
              href={`/report/${propertyId}`}
              className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-zinc-200"
            >
              Report
            </Link>
          )}
        </div>
        <div className="pointer-events-auto">
          <SurfacePrompt room={room} surface={surface} reason={reason} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-6 pt-16">
        <div className="pointer-events-auto space-y-3">
          {resultScan && (
            <div className="rounded-2xl bg-zinc-900/95 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Finding</p>
                <DetectorBadge detector={resultScan.detector} sample={resultScan.isSample} />
              </div>
              <p className="mt-2 text-sm leading-relaxed">{resultScan.finding}</p>
              {citationLines(resultScan.detections).map((c) => (
                <p key={c} className="mt-1 text-[11px] leading-snug text-amber-200">
                  {c}
                </p>
              ))}
              {resultScan.escalations?.length ? (
                <p className="mt-2 text-xs text-rose-300">
                  {resultScan.escalations.map((e) => `${e.from} → ${e.to}`).join(" · ")}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-emerald-300">
                {(resultScan.totalAffectedRatio * 100).toFixed(1)}% of frame affected
              </p>
              <button
                type="button"
                onClick={resumeLive}
                className="mt-3 w-full rounded-full bg-emerald-400 py-2.5 text-sm font-semibold text-black"
              >
                Back to live
              </button>
            </div>
          )}

          {!resultScan && (
            <div className="grid grid-cols-3 gap-2">
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-xs"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  const next = KNOWN_SURFACES.find((s) => s.room === e.target.value);
                  if (next) setSurface(next.surface);
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-xs"
              >
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-xs"
              >
                {surfaces.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-center text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    </main>
  );
}
