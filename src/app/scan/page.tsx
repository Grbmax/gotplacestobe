"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { DetectorBadge } from "@/components/DetectorBadge";
import { HouseSelect } from "@/components/HouseSelect";
import { SurfacePrompt } from "@/components/SurfacePrompt";
import { Viewfinder } from "@/components/Viewfinder";
import { lastHouse, rememberHouse, rememberWalk } from "@/lib/activeHouse";
import { ScanWalkPicker } from "@/components/ScanWalkPicker";
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
import { scansForWalk, walkKindLabel } from "@/lib/walks";
import type { Detection, Property, Scan, WalkKind } from "@/lib/types";

export default function ScanPage() {
  return (
    <Suspense fallback={<main className="grid h-dvh place-items-center text-sm text-slate-500">Loading…</main>}>
      <ScanFlow />
    </Suspense>
  );
}

function ScanFlow() {
  const { identity } = useIdentity();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("propertyId");
  const requestedWalkId = searchParams.get("walkId");
  const [walkBusy, setWalkBusy] = useState(false);

  const [properties, setProperties] = useState<Property[] | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
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
    () => scannableProperties.find((p) => p.id === requestedId) ?? null,
    [scannableProperties, requestedId],
  );
  const propertyId = house?.id ?? "";
  const walk = useMemo(
    () => (house?.walks ?? []).find((w) => w.id === requestedWalkId) ?? null,
    [house, requestedWalkId],
  );
  const walkScans = useMemo(
    () => (walk ? scansForWalk(pastScans, walk.id) : []),
    [pastScans, walk],
  );

  const ghostUrl = useMemo(() => {
    const sameWalk = walk
      ? pastScans.find((s) => s.walkId === walk.id && s.room === room && s.surface === surface)
      : null;
    const any = pastScans.find((s) => s.room === room && s.surface === surface);
    return sameWalk?.imageUrl ?? any?.imageUrl ?? null;
  }, [pastScans, walk, room, surface]);

  const applyPlanner = useCallback((scans: Scan[], nextHouse?: Property) => {
    const next = nextBestSurface(coverageFromScans(scans), nextHouse?.cityContext?.civic);
    setRoom(next.room);
    setSurface(next.surface);
    setReason(next.reason);
  }, []);

  useEffect(() => {
    setRecentId(lastHouse());
    void fetch("/api/properties", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { properties: Property[] }) => setProperties(data.properties))
      .catch(() => setError("Could not load properties"));
  }, []);

  function attachHouse(property: Property) {
    rememberHouse(property.id);
    router.push(`/scan?propertyId=${property.id}`);
  }

  function attachWalk(walkId: string) {
    if (!propertyId) return;
    rememberWalk(propertyId, walkId);
    router.push(`/scan?propertyId=${propertyId}&walkId=${walkId}`);
  }

  async function startWalk(kind: WalkKind) {
    if (!propertyId) return;
    setWalkBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/walks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, createdBy: identity.id, createdByName: identity.name }),
      });
      const data = (await res.json()) as { walk?: { id: string }; property?: Property; error?: string };
      if (!res.ok || !data.walk) throw new Error(data.error ?? "Could not start walk");
      if (data.property) {
        setProperties((prev) => (prev ?? []).map((p) => (p.id === data.property!.id ? data.property! : p)));
      }
      attachWalk(data.walk.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start walk");
    } finally {
      setWalkBusy(false);
    }
  }

  async function closeAllWalks() {
    if (!propertyId) return;
    setWalkBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/walks`, { method: "PATCH" });
      const data = (await res.json()) as { property?: Property; error?: string };
      if (!res.ok || !data.property) throw new Error(data.error ?? "Could not close records");
      setProperties((prev) => (prev ?? []).map((p) => (p.id === data.property!.id ? data.property! : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close records");
    } finally {
      setWalkBusy(false);
    }
  }

  useEffect(() => {
    if (!propertyId) {
      setPastScans([]);
      return;
    }
    rememberHouse(propertyId);
    void (async () => {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`, { cache: "no-store" }),
        fetch(`/api/scans?propertyId=${propertyId}`, { cache: "no-store" }),
      ]);
      const pData = (await pRes.json()) as { property?: Property };
      if (pData.property) {
        setProperties((prev) => {
          const list = prev ?? [];
          const i = list.findIndex((p) => p.id === pData.property!.id);
          if (i < 0) return [pData.property!, ...list];
          return list.map((p) => (p.id === pData.property!.id ? pData.property! : p));
        });
      }
      const sData = (await sRes.json()) as { scans: Scan[] };
      const scans = sData.scans ?? [];
      setPastScans(scans);
    })().catch(() => undefined);
  }, [propertyId]);

  useEffect(() => {
    if (!walk) return;
    applyPlanner(walkScans, house ?? undefined);
  }, [walk, walkScans, house, applyPlanner]);

  const rooms = useMemo(() => [...new Set(KNOWN_SURFACES.map((s) => s.room))], []);
  const surfaces = useMemo(
    () => KNOWN_SURFACES.filter((s) => s.room === room).map((s) => s.surface),
    [room],
  );

  async function onCapture(dataUrl: string) {
    if (!propertyId || !walk) {
      setError("Pick a house and a record first");
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
          walkId: walk?.id,
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
      applyPlanner(scansForWalk(nextList, walk?.id ?? "all"), house ?? undefined);
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
    return <main className="grid h-dvh place-items-center text-sm text-slate-500">Loading…</main>;
  }

  if (!house) {
    return (
      <HouseSelect intent="scan" houses={scannableProperties} lastId={recentId} onCreated={attachHouse} />
    );
  }

  if (!walk) {
    return (
      <>
        {error && (
          <p className="mx-auto max-w-md px-5 pt-6 text-sm text-rose-600">{error}</p>
        )}
        <ScanWalkPicker
          house={house}
          busy={walkBusy}
          onContinue={(item) => attachWalk(item.id)}
          onCreate={startWalk}
          onCloseAll={() => void closeAllWalks()}
          onCheckReport={() => router.push(`/report/${house.id}`)}
        />
      </>
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
          <BackLink href={`/scan?propertyId=${propertyId}`} tone="overlay">
            Change record
          </BackLink>
          <div className="flex items-center gap-2">
            {ghostUrl && !resultScan && (
              <button
                type="button"
                onClick={() => setGhostOn((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-xs ${ghostOn ? "bg-emerald-600 text-white" : "bg-black/55 text-zinc-200"}`}
              >
                {ghostOn ? "Hide last photo" : "Show last photo"}
              </button>
            )}
          </div>
        </div>
        {!resultScan && (
          <div className="pointer-events-auto space-y-2">
            <button
              type="button"
              onClick={() => router.push(`/scan?propertyId=${propertyId}`)}
              className="w-full rounded-2xl bg-black/55 px-4 py-2 text-left backdrop-blur"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                {walkKindLabel(walk.kind)} · {house.label}
              </p>
              <p className="truncate text-sm font-medium">{house.label}</p>
              <p className="text-[11px] text-white/60">Tap to change house or record</p>
            </button>
            <SurfacePrompt
              room={room}
              surface={surface}
              reason={reason}
              hint={alignmentHint}
              covered={coverageFromScans(walkScans).length}
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
                <div className="grid grid-cols-2 gap-2">
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
                    applyPlanner(walkScans, house);
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-24 pt-16">
          <div className="pointer-events-auto space-y-3">
            {resultScan && (
              <div
                className={`rounded-2xl p-4 ${
                  resultScan.degraded ? "border-2 border-rose-500 bg-rose-950/40" : "bg-zinc-900/95"
                }`}
              >
                {(resultScan.detector !== "gemini" || resultScan.isSample || resultScan.degraded) && (
                  <div className="mb-2">
                    <DetectorBadge
                      detector={resultScan.detector}
                      sample={resultScan.isSample}
                      degraded={resultScan.degraded}
                    />
                  </div>
                )}
                <p className="text-sm leading-relaxed">{resultScan.finding}</p>
                {resultScan.imagineUrl && !resultScan.degraded && (
                  <figure className="mt-3 overflow-hidden rounded-xl border border-sky-400/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultScan.imagineUrl}
                      alt="Educational illustration of untreated progression"
                      className="aspect-video w-full object-cover"
                    />
                    <figcaption className="bg-sky-950/50 px-3 py-2 text-[10px] uppercase tracking-wider text-sky-200">
                      Grok Imagine · educational still — not a photo of this unit
                    </figcaption>
                  </figure>
                )}
                {!resultScan.degraded && (
                  <p className={`mt-2 text-xs ${severityTextClass(severityFromRatio(resultScan.totalAffectedRatio))}`}>
                    {thisFrameFlaggedCopy(resultScan.totalAffectedRatio)}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-emerald-200">Now point at recommended surface</p>
                <p className="mt-1 text-sm text-emerald-100">{roomSurfaceLabel(room, surface)}</p>
                <button
                  type="button"
                  onClick={resumeLive}
                  className="mt-3 w-full rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white"
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
