"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DetectorBadge } from "@/components/DetectorBadge";
import { IdentityChip } from "@/components/IdentityChip";
import { SurfacePrompt } from "@/components/SurfacePrompt";
import { Viewfinder } from "@/components/Viewfinder";
import { useIdentity } from "@/lib/IdentityContext";
import { KNOWN_SURFACES, nextBestSurface } from "@/lib/nextbest";
import type { Detection, Property, Scan, SurfaceCoverage } from "@/lib/types";

export default function ScanPage() {
  const { identity } = useIdentity();
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [room, setRoom] = useState("bathroom");
  const [surface, setSurface] = useState("ceiling_vent");
  const [reason, setReason] = useState("never scanned · high-risk surface");
  const [analyzing, setAnalyzing] = useState(false);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const [resultDets, setResultDets] = useState<Detection[] | null>(null);
  const [resultScan, setResultScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastScans, setPastScans] = useState<Scan[]>([]);
  const [ghostOn, setGhostOn] = useState(true);
  const [coveredCount, setCoveredCount] = useState(0);

  const scannableProperties = useMemo(() => (properties ?? []).filter((p) => !p.isSample), [properties]);

  // Latest past scan of the currently selected room+surface, newest-first from the API already.
  const ghostUrl = useMemo(() => {
    const match = pastScans.find((s) => s.room === room && s.surface === surface);
    return match?.imageUrl ?? null;
  }, [pastScans, room, surface]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/properties", { cache: "no-store" });
      const data = (await res.json()) as { properties: Property[] };
      setProperties(data.properties);
      // Never default onto the sample property — a real scan must never land
      // on fixed demo data, or the progression graph blends fake and real.
      const first = data.properties.find((p) => !p.isSample);
      if (first) setPropertyId(first.id);
    })().catch(() => setError("Could not load properties"));
  }, []);

  async function refreshGuidance(pid: string) {
    const res = await fetch(`/api/scans?propertyId=${pid}`, { cache: "no-store" });
    const data = (await res.json()) as { scans: Scan[] };
    setPastScans(data.scans ?? []);
    const map = new Map<string, SurfaceCoverage>();
    // /api/scans returns newest-first, so the first hit per key is the latest scan.
    for (const s of data.scans) {
      const key = `${s.room}::${s.surface}`;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          room: s.room,
          surface: s.surface,
          lastScannedAt: s.capturedAt,
          scanCount: 1,
          lastDetections: s.detections,
        });
      } else {
        cur.scanCount += 1;
      }
    }
    setCoveredCount(map.size);
    const next = nextBestSurface([...map.values()]);
    setRoom(next.room);
    setSurface(next.surface);
    setReason(next.reason);
  }

  // Re-guide on property change, AND every time a scan actually completes (see onCapture) —
  // otherwise the prompt goes stale after the very first shot, which defeats the entire point.
  useEffect(() => {
    if (!propertyId) return;
    void refreshGuidance(propertyId).catch(() => undefined);
  }, [propertyId]);

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
        body: JSON.stringify({
          propertyId,
          room,
          surface,
          image: dataUrl,
          scannedBy: identity.id,
          scannedByName: identity.name,
        }),
      });
      const data = (await res.json()) as { scan?: Scan; error?: string };
      if (!res.ok || !data.scan) throw new Error(data.error ?? "scan failed");
      setResultScan(data.scan);
      setResultDets(data.scan.detections);
      // Recompute the guided prompt now, while the Finding card is up — so by the
      // time "Back to live" is tapped, the next recommendation is already showing.
      void refreshGuidance(propertyId).catch(() => undefined);
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

  // Loading, or nothing scannable yet — don't hand the camera to a dead-end flow.
  if (properties === null) {
    return <main className="grid h-dvh place-items-center bg-black text-sm text-zinc-500">Loading…</main>;
  }
  if (scannableProperties.length === 0) {
    return (
      <main className="grid h-dvh place-items-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">SCAN</p>
          <h1 className="mt-2 text-2xl font-semibold">Add a property first</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">
            The one showing on the home screen is sample data — create your own before scanning, so your real
            findings don&apos;t get mixed into a fake trend.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black"
          >
            Go add one
          </Link>
        </div>
      </main>
    );
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
          ghostUrl={ghostOn ? ghostUrl : null}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-3 p-4">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <Link href="/" className="rounded-full bg-black/55 px-3 py-1.5 text-xs uppercase tracking-wider">
            SCAN
          </Link>
          <div className="flex items-center gap-2">
            <IdentityChip />
            {ghostUrl && (
              <button
                type="button"
                onClick={() => setGhostOn((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-xs ${ghostOn ? "bg-emerald-400 text-black" : "bg-black/55 text-zinc-200"}`}
              >
                Ghost {ghostOn ? "on" : "off"}
              </button>
            )}
            {propertyId && (
              <Link
                href={`/report/${propertyId}`}
                className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-zinc-200"
              >
                Report
              </Link>
            )}
          </div>
        </div>
        <div className="pointer-events-auto">
          <SurfacePrompt
            room={room}
            surface={surface}
            reason={reason}
            covered={coveredCount}
            total={KNOWN_SURFACES.length}
          />
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
                {scannableProperties.map((p) => (
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
