"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CampusMap } from "@/components/CampusMap";
import { SwipeDeck } from "@/components/SwipeDeck";
import { apiClaimQuest, apiCreateSession, apiListQuests, apiMe } from "@/lib/api";
import { MOCK_QUESTS, rankedFeed, zoneById } from "@/lib/data";
import { isOnCampus } from "@/lib/geo";
import { loadSession, saveSession } from "@/lib/session";
import type { LatLng, Quest, Session } from "@/lib/types";

export default function MapPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [quests, setQuests] = useState<Quest[]>(MOCK_QUESTS);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [youPos, setYouPos] = useState<LatLng | null>(null);

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      router.replace("/join");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await apiMe(existing.id);
        if (cancelled) return;
        saveSession(me.user);
        setSession(me.user);
      } catch {
        try {
          const created = await apiCreateSession(existing.name, existing.zone);
          if (cancelled) return;
          saveSession(created.user);
          setSession(created.user);
        } catch {
          if (!cancelled) setSession(existing);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!session) return;
    const fallback = { lat: zoneById(session.zone).lat, lng: zoneById(session.zone).lng };
    setYouPos((prev) => prev ?? fallback);

    if (!navigator.geolocation) {
      setLive(false);
      return;
    }

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isOnCampus(coords)) {
          setYouPos(coords);
          setSnapped(false);
        } else {
          setYouPos(fallback);
          setSnapped(true);
        }
        setLive(true);
      },
      () => {
        setYouPos(fallback);
        setLive(false);
        setSnapped(true);
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function pull() {
      try {
        const data = await apiListQuests(session!.id);
        if (!cancelled) setQuests(data.quests.length ? data.quests : MOCK_QUESTS);
      } catch {
        /* keep current board */
      }
    }

    pull();
    const t = setInterval(pull, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [session]);

  const feed = useMemo(() => (session ? rankedFeed(session, quests) : []), [session, quests]);
  const current = feed[index] ?? null;
  const next = feed[index + 1] ?? null;

  useEffect(() => {
    if (index >= feed.length) setIndex(Math.max(0, feed.length - 1));
  }, [feed.length, index]);

  function skip() {
    setIndex((i) => i + 1);
  }

  async function accept() {
    if (!current || !session) return;
    setQuests((prev) =>
      prev.map((q) =>
        q.id === current.id
          ? { ...q, status: "CLAIMED", helperId: session.id, helperName: session.name, updatedAt: Date.now() }
          : q,
      ),
    );
    try {
      await apiClaimQuest(current.id, session.id);
    } catch {
      /* optimistic board still updates */
    }
    setFlash(`You took ${current.requesterName}’s quest. Walk to ${zoneById(current.zone).short}.`);
    setTimeout(() => setFlash(null), 2800);
  }

  if (!session || !youPos) return null;

  return (
    <main className="min-h-dvh bg-[#0a0e09] text-paper md:flex md:items-center md:justify-center md:p-8">
      <div className="relative h-dvh w-full overflow-hidden bg-moss md:h-[844px] md:w-[390px] md:rounded-[2.5rem] md:border-[10px] md:border-ink md:shadow-2xl">
        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 pt-5">
          <Link href="/" className="rounded-full bg-ink/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em]">
            Quest
          </Link>
          <div className="rounded-full bg-ink/80 px-3 py-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 text-live">
              <span className="h-1.5 w-1.5 rounded-full bg-live" />
              {live ? "live" : "zone"} · {zoneById(session.zone).short}
            </span>
          </div>
          <Link href="/wallet" className="rounded-full bg-ink/80 px-3 py-1.5 text-[11px] text-gold">
            {session.karma} k
          </Link>
        </header>

        <div className="absolute inset-0">
          <CampusMap
            you={session.zone}
            youPos={youPos}
            quests={feed}
            activeId={current?.id}
            onSelect={(id) => {
              const i = feed.findIndex((q) => q.id === id);
              if (i >= 0) setIndex(i);
            }}
          />
        </div>

        <div className="absolute inset-x-0 top-14 z-20 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {feed.slice(0, 4).map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setIndex(feed.findIndex((x) => x.id === q.id))}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs shadow ${
                current?.id === q.id ? "bg-leaf text-ink" : "bg-ink/80 text-paper"
              }`}
            >
              {zoneById(q.zone).short} · +{q.baseKarma + q.bonusKarma}
            </button>
          ))}
        </div>

        {snapped && (
          <p className="absolute inset-x-3 top-[6.4rem] z-20 rounded-full bg-ink/75 px-3 py-1.5 text-center text-[11px] text-paper/70">
            Pin snapped to your zone — indoor GPS stays out of matching
          </p>
        )}

        {flash && (
          <div className="absolute inset-x-3 top-[6.5rem] z-30 rounded-2xl bg-leaf px-4 py-3 text-sm text-ink shadow-lg">
            {flash}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-moss via-moss/90 to-transparent px-3 pb-5 pt-16">
          <div className="pointer-events-auto">
            <SwipeDeck quest={current} next={next} onSkip={skip} onAccept={accept} />
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-[11px] text-paper/45">Swipe right to take · left to skip</p>
              <Link
                href="/create"
                className="rounded-full bg-leaf px-4 py-2 text-xs font-semibold text-ink"
              >
                Post a quest
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
