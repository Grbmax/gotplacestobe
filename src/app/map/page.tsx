"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveTask } from "@/components/ActiveTask";
import { type AppTab, BottomNav } from "@/components/BottomNav";
import { CampusMap } from "@/components/CampusMap";
import { ProfilePanel } from "@/components/ProfilePanel";
import { QuickPost } from "@/components/QuickPost";
import { SwipeDeck } from "@/components/SwipeDeck";
import {
  apiBailQuest,
  apiClaimQuest,
  apiConfirmQuest,
  apiCreateQuest,
  apiCreateSession,
  apiListQuests,
  apiMarkDone,
  apiMe,
} from "@/lib/api";
import { CLAIM_MS, MOCK_QUESTS, rankedFeed, zoneById } from "@/lib/data";
import { isOnCampus } from "@/lib/geo";
import { loadSession, saveSession } from "@/lib/session";
import type { LatLng, Quest, Session, Transaction, Urgency, ZoneId } from "@/lib/types";

const seedTx: Transaction[] = [
  { id: "t1", label: "Confirmed · charger walk", amount: 30, when: "Today 01:12" },
  { id: "t2", label: "Posted · HDMI swap", amount: -20, when: "Today 00:48" },
  { id: "t3", label: "Confirmed · hold table", amount: 25, when: "Thu 23:10" },
];

function remainingMs(quest: Quest | null, now: number) {
  if (!quest?.claimedAt || quest.status !== "CLAIMED") return 0;
  return Math.max(0, CLAIM_MS - (now - quest.claimedAt));
}

export default function MapPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [quests, setQuests] = useState<Quest[]>(MOCK_QUESTS);
  const [tx, setTx] = useState<Transaction[]>(seedTx);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [youPos, setYouPos] = useState<LatLng | null>(null);
  const [tab, setTab] = useState<AppTab>("map");
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const autoReleaseRef = useRef<string | null>(null);

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
        if (me.transactions.length) setTx(me.transactions);
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
      setSnapped(true);
      setYouPos(fallback);
      return;
    }

    let watchId: number | null = null;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isOnCampus(coords)) {
          setYouPos(fallback);
          setSnapped(true);
          setLive(false);
          return;
        }
        setYouPos(coords);
        setSnapped(false);
        setLive(true);
        watchId = navigator.geolocation.watchPosition(
          (next) => {
            const liveCoords = { lat: next.coords.latitude, lng: next.coords.longitude };
            if (isOnCampus(liveCoords)) setYouPos(liveCoords);
          },
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
        );
      },
      () => {
        setYouPos(fallback);
        setLive(false);
        setSnapped(true);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 },
    );

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [session?.id, session?.zone]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function pull() {
      try {
        const data = await apiListQuests(session!.id);
        if (!cancelled && data.quests.length) setQuests(data.quests);
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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const feed = useMemo(() => (session ? rankedFeed(session, quests) : []), [session, quests]);
  const current = feed[index] ?? null;
  const next = feed[index + 1] ?? null;
  const myClaim = session
    ? quests.find(
        (q) =>
          q.helperId === session.id && (q.status === "CLAIMED" || q.status === "PENDING"),
      ) ?? null
    : null;
  const pendingMine = session
    ? quests.find((q) => q.requesterId === session.id && q.status === "PENDING") ?? null
    : null;
  const active =
    myClaim?.status === "CLAIMED" ? myClaim : pendingMine ?? myClaim;
  const activeRole: "helper" | "requester" =
    active && pendingMine && active.id === pendingMine.id ? "requester" : "helper";
  const left = remainingMs(myClaim?.status === "CLAIMED" ? myClaim : null, now);

  useEffect(() => {
    if (index >= feed.length) setIndex(Math.max(0, feed.length - 1));
  }, [feed.length, index]);

  useEffect(() => {
    if (!active || active.status !== "CLAIMED") {
      autoReleaseRef.current = null;
      return;
    }
    if (left > 0) return;
    if (autoReleaseRef.current === active.id) return;
    autoReleaseRef.current = active.id;
    void release(active.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.status, left]);

  function skip() {
    setIndex((i) => i + 1);
  }

  async function accept() {
    if (!current || !session) return;
    const claimedAt = Date.now();
    setQuests((prev) =>
      prev.map((q) =>
        q.id === current.id
          ? {
              ...q,
              status: "CLAIMED" as const,
              helperId: session.id,
              helperName: session.name,
              claimedAt,
              updatedAt: claimedAt,
            }
          : q,
      ),
    );
    setTab("active");
    try {
      await apiClaimQuest(current.id, session.id);
    } catch {
      /* optimistic board still updates */
    }
  }

  async function release(id: string, timedOut = false) {
    if (!session) return;
    setQuests((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: "OPEN",
              helperId: undefined,
              helperName: undefined,
              claimedAt: undefined,
              updatedAt: Date.now(),
            }
          : q,
      ),
    );
    try {
      const data = await apiBailQuest(id, session.id);
      if (data.user) {
        saveSession(data.user);
        setSession(data.user);
      }
    } catch {
      /* local release still stands */
    }
    setFlash(timedOut ? "Five minutes up — it’s back on the map." : "Released. Someone else can take it.");
    setTimeout(() => setFlash(null), 2800);
    setTab("map");
  }

  async function finish(id: string) {
    if (!session) return;
    setQuests((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "PENDING" as const, updatedAt: Date.now() } : q)),
    );
    try {
      await apiMarkDone(id, session.id);
    } catch {
      /* keep pending locally */
    }
  }

  async function confirm(id: string) {
    if (!session) return;
    setQuests((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, status: "CONFIRMED" as const, updatedAt: Date.now() } : q,
      ),
    );
    try {
      await apiConfirmQuest(id, session.id);
      setFlash("Confirmed. Karma went to your helper.");
      setTimeout(() => setFlash(null), 2800);
      setTab("map");
    } catch {
      /* keep confirmed locally */
    }
  }

  async function postQuest(input: { title: string; zone: ZoneId; urgency: Urgency }) {
    if (!session) return;
    setPostBusy(true);
    setPostError(null);
    try {
      let user = session;
      try {
        const created = await apiCreateQuest({ userId: user.id, ...input });
        saveSession(created.user);
        setSession(created.user);
        setQuests((prev) => [created.quest, ...prev.filter((q) => q.id !== created.quest.id)]);
      } catch {
        const registered = await apiCreateSession(user.name, user.zone);
        user = registered.user;
        saveSession(user);
        setSession(user);
        const created = await apiCreateQuest({ userId: user.id, ...input });
        saveSession(created.user);
        setSession(created.user);
        setQuests((prev) => [created.quest, ...prev.filter((q) => q.id !== created.quest.id)]);
      }
      setTab("map");
      setFlash("Posted. It’s on the map.");
      setTimeout(() => setFlash(null), 2200);
    } catch {
      setPostError("Couldn’t post. Try once more.");
    } finally {
      setPostBusy(false);
    }
  }

  if (!session || !youPos) return null;

  const timerLabel =
    myClaim?.status === "CLAIMED" && left > 0
      ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`
      : undefined;

  return (
    <main className="min-h-dvh bg-[#0a0e09] text-paper md:flex md:items-center md:justify-center md:p-8">
      <div className="relative isolate h-dvh w-full overflow-hidden bg-[#151c12] md:h-[844px] md:w-[390px] md:rounded-[2.5rem] md:border-[10px] md:border-ink md:shadow-2xl">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 pt-5">
          <Link
            href="/"
            className="pointer-events-auto rounded-full bg-ink/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em]"
          >
            Quest
          </Link>
          <div className="rounded-full bg-ink/80 px-3 py-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 text-live">
              <span className="h-1.5 w-1.5 rounded-full bg-live" />
              {live ? "live" : "zone"} · {zoneById(session.zone).short}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTab("you")}
            className="pointer-events-auto rounded-full bg-ink/80 px-3 py-1.5 text-[11px] text-gold"
          >
            {session.karma} k
          </button>
        </header>

        <div className="absolute inset-0 z-0 overflow-hidden">
          <CampusMap
            you={session.zone}
            youPos={youPos}
            quests={feed}
            activeId={current?.id}
            onSelect={(id) => {
              const i = feed.findIndex((q) => q.id === id);
              if (i >= 0) {
                setIndex(i);
                setTab("map");
              }
            }}
          />
        </div>

        {tab === "map" && (
          <>
            <div className="absolute inset-x-0 top-14 z-20 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {feed.slice(0, 5).map((q) => (
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
                Off campus — pin stays on {zoneById(session.zone).short}
              </p>
            )}

            {flash && (
              <div className="absolute inset-x-3 top-[6.5rem] z-30 rounded-2xl bg-leaf px-4 py-3 text-sm text-ink shadow-lg">
                {flash}
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 bg-gradient-to-t from-[#151c12] via-[#151c12]/90 to-transparent px-3 pb-2 pt-16">
              <div className="pointer-events-auto">
                <SwipeDeck quest={current} next={next} onSkip={skip} onAccept={accept} />
                <p className="mt-2 px-1 text-[11px] text-paper/45">Swipe right to take · left to skip</p>
              </div>
            </div>
          </>
        )}

        {tab !== "map" && (
          <div className="absolute inset-x-0 bottom-16 top-0 z-40 overflow-hidden bg-ink">
            {tab === "post" && (
              <QuickPost
                session={session}
                busy={postBusy}
                error={postError}
                onClose={() => setTab("map")}
                onSubmit={postQuest}
              />
            )}
            {tab === "active" && (
              <ActiveTask
                quest={active}
                remainingMs={left}
                role={activeRole}
                onClose={() => setTab("map")}
                onBail={() => myClaim && release(myClaim.id)}
                onDone={() => myClaim && finish(myClaim.id)}
                onConfirm={() => pendingMine && confirm(pendingMine.id)}
              />
            )}
            {tab === "you" && (
              <ProfilePanel session={session} tx={tx} onClose={() => setTab("map")} />
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-50">
          <BottomNav
            tab={tab}
            hasActive={Boolean(myClaim || pendingMine)}
            remainingLabel={timerLabel}
            onChange={(next) => {
              if (next === "you") {
                void apiMe(session.id)
                  .then((me) => {
                    saveSession(me.user);
                    setSession(me.user);
                    if (me.transactions.length) setTx(me.transactions);
                  })
                  .catch(() => undefined);
              }
              setTab(next);
            }}
          />
        </div>
      </div>
    </main>
  );
}
