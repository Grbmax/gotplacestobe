"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { DetectorBadge } from "@/components/DetectorBadge";
import { SurfacePrompt } from "@/components/SurfacePrompt";
import { Viewfinder } from "@/components/Viewfinder";
import { useIdentity } from "@/lib/IdentityContext";
import {
  roomLabel,
  roomSurfaceLabel,
  severityFromRatio,
  severityTextClass,
  surfaceLabel,
  thisFrameFlaggedCopy,
} from "@/lib/labels";
import { KNOWN_SURFACES, coverageFromScans, nextBestSurface } from "@/lib/nextbest";
import type { Detection, Property, Scan } from "@/lib/types";

export default function ScanPage() {
  const { identity } = useIdentity();
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [room, setRoom] = useState("bathroom");
  const [surface, setSurface] = useState("ceiling_vent");
  const [reason, setReason] = useState("Never scanned · high-risk surface");
  const [analyzing, setAnalyzing] = useState(false);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const [resultDets, setResultDets] = useState<Detection[] | null>(null);
  const [resultScan, setResultScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastScans, setPastScans] = useState<Scan[]>([]);
  const [ghostOn, setGhostOn] = useState(true);
  const [pickSurface, setPickSurface] = useState(false);

  const scannableProperties = useMemo(() => (properties ?? []).filter((p) => !p.isSample), [properties]);
  const house = useMemo(
    () => (properties ?? []).find((p) => p.id === propertyId),
    [properties, propertyId],
  );

  const ghostUrl = useMemo(() => {
    const match = pastScans.find((s) => s.room === room && s.surface === surface);
    return match?.imageUrl ?? null;
  }, [pastScans, room, surface]);

  const applyPlanner = useCallback(
    (scans: Scan[], nextHouse?: Property) => {
      const next = nextBestSurface(coverageFromScans(scans), nextHouse?.cityContext?.civic);
      setRoom(next.room);
      setSurface(next.surface);
      setReason(next.reason);
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/properties", { cache: "no-store" });
      const data = (await res.json()) as { properties: Property[] };
      setProperties(data.properties);
      const requested =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("propertyId") : null;
      const match = requested && data.properties.find((p) => p.id === requested && !p.isSample);
      const first = match ?? data.properties.find((p) => !p.isSample);
      if (first) setPropertyId(first.id);
    })().catch(() => setError("Could not load properties"));
  }, []);

  // Re-guide on property change, AND every time a scan actually completes (see onCapture) —
  // otherwise the prompt goes stale after the very first shot, which defeats the entire point.
  useEffect(() => {
    if (!propertyId) return;
    void (async () => {
      const res = await fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" });
      const data = (await res.json()) as { scans: Scan[] };
      const scans = data.scans ?? [];
      setPastScans(scans);
      const nextHouse = (properties ?? []).find((p) => p.id === propertyId);
      applyPlanner(scans, nextHouse);
    })().catch(() => undefined);
  }, [propertyId, properties, applyPlanner]);

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
      const nextList = [data.scan, ...pastScans];
      setPastScans(nextList);
      applyPlanner(nextList, house);
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

  const alignmentHint = ghostUrl ? "Line this up with your last shot" : "First shot of this surface";

  return (
    <main className="relative h-dvh overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <Viewfinder
          onCapture={onCapture}
          analyzing={analyzing}
          frozenUrl={frozenUrl}
          resultDetections={resultDets}
          ghostUrl={ghostOn ? ghostUrl : null}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-3 p-4">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <BackLink href={propertyId ? `/report/${propertyId}` : "/"} tone="overlay">
            {propertyId ? "Report" : "Houses"}
          </BackLink>
          <div className="flex items-center gap-2">
            {ghostUrl && !resultScan && (
              <button
                type="button"
                onClick={() => setGhostOn((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-xs ${ghostOn ? "bg-emerald-400 text-black" : "bg-black/55 text-zinc-200"}`}
              >
                {ghostOn ? "Hide last photo" : "Show last photo"}
              </button>
            )}
          </div>
        </div>
        {!resultScan && (
          <div className="pointer-events-auto space-y-2">
            <SurfacePrompt
              room={room}
              surface={surface}
              reason={reason}
              hint={alignmentHint}
              covered={coverageFromScans(pastScans).length}
              total={KNOWN_SURFACES.length}
            />
            {!pickSurface ? (
              <button
                type="button"
                onClick={() => setPickSurface(true)}
                className="w-full rounded-2xl bg-black/55 py-2 text-center text-xs text-zinc-300 backdrop-blur"
              >
                Different surface
              </button>
            ) : (
              <div className="space-y-2 rounded-2xl bg-black/55 p-2 backdrop-blur">
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
                        {roomLabel(r)}
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
                        {surfaceLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    applyPlanner(pastScans, house);
                    setPickSurface(false);
                  }}
                  className="w-full text-center text-xs text-zinc-300 underline underline-offset-4"
                >
                  Use the recommended surface
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {(resultScan || error) && (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-6 pt-16">
        <div className="pointer-events-auto space-y-3">
          {resultScan && (
            <div className="rounded-2xl bg-zinc-900/95 p-4">
              {(resultScan.detector === "mock" || resultScan.isSample) && (
                <div className="mb-2">
                  <DetectorBadge detector={resultScan.detector} sample={resultScan.isSample} />
                </div>
              )}
              <p className="text-sm leading-relaxed">{resultScan.finding}</p>
              <p className={`mt-2 text-xs ${severityTextClass(severityFromRatio(resultScan.totalAffectedRatio))}`}>
                {thisFrameFlaggedCopy(resultScan.totalAffectedRatio)}
              </p>
              <p className="mt-3 text-sm font-medium text-emerald-200">
                Now point at {roomSurfaceLabel(room, surface)}
              </p>
              <button
                type="button"
                onClick={resumeLive}
                className="mt-3 w-full rounded-full bg-emerald-400 py-2.5 text-sm font-semibold text-black"
              >
                Next surface
              </button>
            </div>
          )}

          {error && <p className="text-center text-xs text-rose-400">{error}</p>}
        </div>
      </div>
      )}
    </main>
  );
}
