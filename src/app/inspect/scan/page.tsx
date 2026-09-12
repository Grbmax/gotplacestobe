"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DetectorBadge } from "@/components/scan/DetectorBadge";
import { SurfacePrompt } from "@/components/scan/SurfacePrompt";
import { Viewfinder } from "@/components/scan/Viewfinder";
import { KNOWN_SURFACES, nextBestSurface } from "@/lib/scan/nextbest";
import type { Detection, Property, Scan, SurfaceCoverage } from "@/lib/scan/types";

export default function InspectScanPage() {
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
    })().catch(() => setError("Could not load places"));
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
          map.set(key, {
            room: s.room,
            surface: s.surface,
            lastScannedAt: s.capturedAt,
            scanCount: 1,
          });
        } else {
          cur.scanCount += 1;
          if (s.capturedAt > (cur.lastScannedAt ?? "")) cur.lastScannedAt = s.capturedAt;
        }
      }
      const next = nextBestSurface([...map.values()]);
      setRoom(next.room);
      setSurface(next.surface);
      setReason(next.reason);
    })().catch(() => undefined);
  }, [propertyId]);

  const rooms = useMemo(() => [...new Set(KNOWN_SURFACES.map((s) => s.room))], []);
  const surfaces = useMemo(
    () => KNOWN_SURFACES.filter((s) => s.room === room).map((s) => s.surface),
    [room],
  );

  async function onCapture(dataUrl: string) {
    if (!propertyId) {
      setError("Add a place first");
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
    <main className="relative h-dvh overflow-hidden bg-ink text-paper">
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
          <Link
            href="/inspect"
            className="rounded-full bg-ink/55 px-3 py-1.5 text-xs uppercase tracking-wider text-leaf"
          >
            Inspect
          </Link>
          {propertyId && (
            <Link
              href={`/inspect/${propertyId}`}
              className="rounded-full bg-ink/55 px-3 py-1.5 text-xs text-paper/85"
            >
              Report
            </Link>
          )}
        </div>
        <div className="pointer-events-auto">
          <SurfacePrompt room={room} surface={surface} reason={reason} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink via-ink/80 to-transparent p-4 pb-6 pt-16">
        <div className="pointer-events-auto space-y-3">
          {resultScan && (
            <div className="rounded-2xl bg-paper p-4 text-ink">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Finding</p>
                <DetectorBadge detector={resultScan.detector} sample={resultScan.isSample} />
              </div>
              <p className="mt-2 text-sm leading-relaxed">{resultScan.finding}</p>
              <p className="mt-2 text-xs text-moss">
                {(resultScan.totalAffectedRatio * 100).toFixed(1)}% of frame affected
              </p>
              {resultScan.detections.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {resultScan.detections.map((d, i) => (
                    <li
                      key={`${d.cls}-${i}`}
                      className="rounded-full border border-ink/10 px-2.5 py-1 text-[10px] uppercase tracking-wider"
                    >
                      {d.cls.replace(/_/g, " ")} · {Math.round(d.confidence * 100)}%
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={resumeLive}
                className="mt-3 w-full rounded-full bg-leaf py-2.5 text-sm font-semibold text-ink"
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
                className="rounded-xl border border-paper/20 bg-ink/90 px-2 py-2 text-xs"
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
                className="rounded-xl border border-paper/20 bg-ink/90 px-2 py-2 text-xs"
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
                className="rounded-xl border border-paper/20 bg-ink/90 px-2 py-2 text-xs"
              >
                {surfaces.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-center text-xs text-urgent">{error}</p>}
        </div>
      </div>
    </main>
  );
}
