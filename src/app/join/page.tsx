"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiCreateSession } from "@/lib/api";
import { anchorWorld, zoneById } from "@/lib/data";
import { nearestZone } from "@/lib/geo";
import { createSession, saveSession } from "@/lib/session";
import type { ZoneId } from "@/lib/types";

type LocState = "detecting" | "ready" | "fallback";

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zone, setZone] = useState<ZoneId>("plaza");
  const [locState, setLocState] = useState<LocState>("detecting");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setZone("plaza");
      setLocState("fallback");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        anchorWorld(coords);
        setZone(nearestZone(coords));
        setLocState("ready");
      },
      () => {
        setZone("plaza");
        setLocState("fallback");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locState === "detecting") return;
    const trimmed = name.trim() || "Guest";
    setBusy(true);
    const local = createSession(trimmed, zone);
    try {
      const { user } = await apiCreateSession(trimmed, zone);
      saveSession(user);
    } catch {
      saveSession(local);
    }
    router.push("/map");
  }

  const zoneLabel = zoneById(zone).name;

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <p className="text-xs uppercase tracking-[0.28em] text-leaf">Wherever you are</p>
        <h1 className="serif mt-3 text-5xl leading-none">Name in. Location finds you.</h1>
        <p className="mt-4 text-sm text-paper/60">
          Live GPS places you. Synthetic nearby spots and favors spawn around you — no campus lock.
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
            {locState === "detecting" ? (
              <>
                <p className="text-sm font-medium text-live">Detecting…</p>
                <p className="mt-1 text-xs text-paper/45">Using your phone’s GPS — works anywhere.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{zoneLabel}</p>
                <p className="mt-1 text-xs text-paper/45">
                  {locState === "ready"
                    ? "World centered on your live GPS"
                    : "GPS blocked — map will retry with your live pin"}
                </p>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || locState === "detecting"}
            className="mt-auto rounded-full bg-leaf py-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Opening map…" : locState === "detecting" ? "Finding you…" : "Open the map"}
          </button>
        </form>
      </div>
    </main>
  );
}
