"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiCreateSession } from "@/lib/api";
import { anchorWorld, zoneById } from "@/lib/data";
import { nearestZone } from "@/lib/geo";
import { createSession, saveSession } from "@/lib/session";
import type { LatLng, ZoneId } from "@/lib/types";

const GPS_KEY = "quest.gps";

type LocState = "detecting" | "ready" | "needed";

function gpsErrorMessage(err?: GeolocationPositionError | null) {
  if (!navigator.geolocation) return "This browser can’t share location.";
  if (!err) return "We need your live location to open the map.";
  if (err.code === err.PERMISSION_DENIED) {
    return "Location is turned off for this site. Allow it, then retry.";
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return "Couldn’t read GPS. Check Location Services for Chrome, then retry.";
  }
  if (err.code === err.TIMEOUT) {
    return "GPS timed out. Move near a window and retry.";
  }
  return "We need your live location to open the map.";
}

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locState, setLocState] = useState<LocState>("detecting");
  const [locError, setLocError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestGps = useCallback(() => {
    setLocState("detecting");
    setLocError(null);
    setZone(null);
    setCoords(null);

    if (!navigator.geolocation) {
      setLocState("needed");
      setLocError(gpsErrorMessage(null));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        anchorWorld(next);
        setCoords(next);
        setZone(nearestZone(next));
        setLocState("ready");
        setLocError(null);
        sessionStorage.setItem(GPS_KEY, JSON.stringify(next));
      },
      (err) => {
        setLocState("needed");
        setLocError(gpsErrorMessage(err));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }, []);

  useEffect(() => {
    requestGps();
  }, [requestGps]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locState !== "ready" || !zone || !coords) return;
    const trimmed = name.trim() || "Guest";
    setBusy(true);
    sessionStorage.setItem(GPS_KEY, JSON.stringify(coords));
    const local = createSession(trimmed, zone);
    try {
      const { user } = await apiCreateSession(trimmed, zone);
      saveSession(user);
    } catch {
      saveSession(local);
    }
    router.push("/map");
  }

  const canOpen = locState === "ready" && zone !== null && !busy;
  const zoneLabel = zone ? zoneById(zone).name : null;

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <p className="text-xs uppercase tracking-[0.28em] text-leaf">Wherever you are</p>
        <h1 className="serif mt-3 text-5xl leading-none">Name in. Location finds you.</h1>
        <p className="mt-4 text-sm text-paper/60">
          Live GPS is required — the map and nearby favors are built around where you actually are.
        </p>

        <form onSubmit={submit} className="mt-10 flex flex-1 flex-col">
          <label className="text-xs uppercase tracking-[0.2em] text-paper/45">What should we call you</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maya"
            className="mt-2 border-b border-paper/20 bg-transparent py-3 text-2xl outline-none placeholder:text-paper/25"
          />

          <p className="mt-10 text-xs uppercase tracking-[0.2em] text-paper/45">Your location</p>
          <div className="mt-3 rounded-2xl bg-paper/8 px-4 py-4">
            {locState === "detecting" && (
              <>
                <p className="text-sm font-medium text-live">Detecting…</p>
                <p className="mt-1 text-xs text-paper/45">Allow location when Chrome asks — no map without it.</p>
              </>
            )}
            {locState === "ready" && zoneLabel && (
              <>
                <p className="text-sm font-medium">{zoneLabel}</p>
                <p className="mt-1 text-xs text-paper/45">World centered on your live GPS</p>
              </>
            )}
            {locState === "needed" && (
              <>
                <p className="text-sm font-medium text-gold">Location required</p>
                <p className="mt-1 text-xs text-paper/55">{locError}</p>
                <p className="mt-3 text-xs text-paper/40">
                  Chrome site settings → Location → Allow. On Mac also check System Settings → Privacy → Location Services → Chrome.
                </p>
                <button
                  type="button"
                  onClick={requestGps}
                  className="mt-4 rounded-full border border-leaf/40 px-4 py-2 text-xs font-semibold text-leaf"
                >
                  Retry GPS
                </button>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={!canOpen}
            className="mt-auto rounded-full bg-leaf py-4 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {busy ? "Opening map…" : locState === "detecting" ? "Finding you…" : locState === "needed" ? "Waiting on GPS" : "Open the map"}
          </button>
        </form>
      </div>
    </main>
  );
}
