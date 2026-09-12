"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveTask } from "@/components/ActiveTask";
import { type AppTab, BottomNav } from "@/components/BottomNav";
import { CampusMap } from "@/components/CampusMap";
import { ProfilePanel } from "@/components/ProfilePanel";
import { QuickPost } from "@/components/QuickPost";
import { ReciprocityChain } from "@/components/ReciprocityChain";
import { SwipeDeck } from "@/components/SwipeDeck";
import {
  apiBailQuest,
  apiChain,
  apiClaimQuest,
  apiConfirmQuest,
  apiCreateQuest,
  apiCreateSession,
  apiMarkDone,
  apiMe,
} from "@/lib/api";
import type { ChainResult } from "@/lib/chain";
import {
  CLAIM_MS,
  MOCK_QUESTS,
  PLACE_EXAMPLES,
  ROUTE_EXAMPLES,
  ZONE_IDS,
  anchorWorld,
  buildRoute,
  favorsOnRoute,
  parseRouteQuery,
  rankedFeed,
  zoneById,
} from "@/lib/data";
import { favorsNearPath, nearestZone } from "@/lib/geo";
import { fetchWalkingPath, searchPlaces, type PlaceSuggestion } from "@/lib/places";
import { loadSession, saveSession } from "@/lib/session";
import type { CampusRoute, LatLng, Quest, Session, Transaction, Urgency, ZoneId } from "@/lib/types";

const seedTx: Transaction[] = [
  { id: "t1", label: "Confirmed · charger walk", amount: 30, when: "Today 01:12" },
  { id: "t2", label: "Posted · HDMI swap", amount: -20, when: "Today 00:48" },
  { id: "t3", label: "Confirmed · hold table", amount: 25, when: "Thu 23:10" },
];

const GPS_KEY = "quest.gps";

function loadSavedGps(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LatLng;
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeZone(zone: string): ZoneId {
  return ZONE_IDS.includes(zone as ZoneId) ? (zone as ZoneId) : "plaza";
}

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
  const [youPos, setYouPos] = useState<LatLng | null>(null);
  const [worldKey, setWorldKey] = useState(0);
  const [routeQuery, setRouteQuery] = useState("");
  const [route, setRoute] = useState<CampusRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [tab, setTab] = useState<AppTab>("map");
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [chain, setChain] = useState<ChainResult | null>(null);
  const autoReleaseRef = useRef<string | null>(null);
  const anchored = useRef(false);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      router.replace("/join");
      return;
    }

    existing.zone = normalizeZone(existing.zone);
    saveSession(existing);

    const savedGps = loadSavedGps();
    if (!savedGps) {
      router.replace("/join");
      return;
    }
    setYouPos(savedGps);
    setLive(true);
    const world = anchorWorld(savedGps);
    setQuests(world.quests);
    anchored.current = true;

    let cancelled = false;
    (async () => {
      try {
        const me = await apiMe(existing.id);
        if (cancelled) return;
        me.user.zone = normalizeZone(me.user.zone);
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

    if (!navigator.geolocation) {
      setLive(false);
      router.replace("/join");
      return;
    }

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        sessionStorage.setItem(GPS_KEY, JSON.stringify(coords));
        setYouPos(coords);
        setLive(true);

        if (!anchored.current) {
          anchored.current = true;
          const world = anchorWorld(coords);
          setQuests(world.quests);
          setWorldKey((k) => k + 1);
          setRoute(null);
        }

        const zone = nearestZone(coords);
        setSession((prev) => {
          if (!prev || prev.zone === zone) return prev;
          const next = { ...prev, zone };
          saveSession(next);
          return next;
        });
      },
      () => {
        if (!loadSavedGps()) {
          setLive(false);
          router.replace("/join");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const ranked = useMemo(() => (session ? rankedFeed(session, quests) : []), [session, quests]);
  const feed = useMemo(() => {
    if (!route) return ranked;
    if (route.zones?.length) return favorsOnRoute(ranked, route);
    return favorsNearPath(ranked, route.path, 550);
  }, [ranked, route]);
  const current = feed[index] ?? null;
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
    setIndex(0);
  }, [route?.label, worldKey]);

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

  useEffect(() => {
    const q = routeQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchBusy(false);
      return;
    }

    // Zone-style routes don't need live autocomplete.
    if (/\b(to|→|->)\b/i.test(q) && parseRouteQuery(q)) {
      setSuggestions([]);
      return;
    }

    setSearchBusy(true);
    const handle = window.setTimeout(() => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      void searchPlaces(q, {
        lat: youPos?.lat,
        lng: youPos?.lng,
        limit: 6,
        signal: ctrl.signal,
      })
        .then((places) => {
          setSuggestions(places);
          setSearchOpen(true);
          setSearchBusy(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setSuggestions([]);
          setSearchBusy(false);
        });
    }, 280);

    return () => {
      window.clearTimeout(handle);
      searchAbort.current?.abort();
    };
  }, [routeQuery, youPos?.lat, youPos?.lng]);

  function clearSearch() {
    setRouteQuery("");
    setRoute(null);
    setRouteError(null);
    setSuggestions([]);
    setSearchOpen(false);
  }

  async function selectPlace(place: PlaceSuggestion) {
    if (!youPos) return;
    setRouteQuery(place.label);
    setSuggestions([]);
    setSearchOpen(false);
    setSearchBusy(true);
    setRouteError(null);
    try {
      const path = await fetchWalkingPath(youPos, { lat: place.lat, lng: place.lng });
      setRoute({
        label: `You → ${place.label}`,
        path,
        destination: { lat: place.lat, lng: place.lng },
      });
    } catch {
      setRoute({
        label: `You → ${place.label}`,
        path: [youPos, { lat: place.lat, lng: place.lng }],
        destination: { lat: place.lat, lng: place.lng },
      });
    } finally {
      setSearchBusy(false);
    }
  }

  async function applyRoute(raw: string) {
    const q = raw.trim();
    setRouteQuery(q);
    if (!q) {
      clearSearch();
      return;
    }

    const parsed = parseRouteQuery(q);
    if (parsed) {
      setRoute(buildRoute(parsed.from, parsed.to));
      setRouteError(null);
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }

    setSearchBusy(true);
    setRouteError(null);
    try {
      const places = await searchPlaces(q, {
        lat: youPos?.lat,
        lng: youPos?.lng,
        limit: 6,
      });
      if (!places.length) {
        setRoute(null);
        setSuggestions([]);
        setRouteError("No places found — try a fuller address or place name");
        return;
      }
      setSuggestions(places);
      setSearchOpen(true);
      // If there's a clear top hit, go there; otherwise show the list.
      if (places.length === 1 || places[0].label.toLowerCase().includes(q.toLowerCase())) {
        await selectPlace(places[0]);
      }
    } catch {
      setRoute(null);
      setRouteError("Search failed — check your connection and try again");
    } finally {
      setSearchBusy(false);
    }
  }

  async function accept(id: string) {
    if (!session) return;
    const quest = quests.find((q) => q.id === id) ?? feed.find((q) => q.id === id);
    if (!quest) return;
    const claimedAt = Date.now();
    setQuests((prev) =>
      prev.map((q) =>
        q.id === id
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
      await apiClaimQuest(id, session.id);
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

  if (!session || !youPos) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink text-paper">
        <p className="text-sm text-paper/60">Loading your map…</p>
      </main>
    );
  }

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
              {live ? "live GPS" : "waiting GPS"} · {zoneById(session.zone).short}
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
            live={live}
            worldKey={worldKey}
            quests={feed}
            route={route}
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
            <form
              className="absolute inset-x-3 top-14 z-20"
              onSubmit={(e) => {
                e.preventDefault();
                void applyRoute(routeQuery);
              }}
            >
              <div className="flex items-center gap-2 rounded-full bg-ink/85 px-3 py-2 shadow-lg backdrop-blur-sm">
                <input
                  value={routeQuery}
                  onChange={(e) => {
                    setRouteQuery(e.target.value);
                    if (routeError) setRouteError(null);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search places · Tepper School of Business"
                  className="min-w-0 flex-1 bg-transparent text-sm text-paper outline-none placeholder:text-paper/35"
                  aria-label="Search for a place or route"
                  autoComplete="off"
                />
                {(route || routeQuery) && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="shrink-0 text-[11px] uppercase tracking-wide text-paper/50"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-leaf px-3 py-1.5 text-[11px] font-semibold text-ink"
                >
                  {searchBusy ? "…" : "Go"}
                </button>
              </div>

              {searchOpen && suggestions.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-2xl bg-ink/95 shadow-xl backdrop-blur-sm">
                  {suggestions.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => void selectPlace(place)}
                        className="flex w-full flex-col gap-0.5 border-b border-paper/10 px-3 py-2.5 text-left last:border-b-0 hover:bg-paper/10"
                      >
                        <span className="text-sm text-paper">{place.label}</span>
                        {place.subtitle ? (
                          <span className="text-[11px] text-paper/45">{place.subtitle}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {routeError && <p className="mt-1.5 px-2 text-[11px] text-urgent">{routeError}</p>}
              {!route && !routeError && !suggestions.length && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {PLACE_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setRouteQuery(ex);
                        void applyRoute(ex);
                      }}
                      className="shrink-0 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] text-paper/70"
                    >
                      {ex}
                    </button>
                  ))}
                  {ROUTE_EXAMPLES.slice(0, 2).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => void applyRoute(ex)}
                      className="shrink-0 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] text-paper/70"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              {route && (
                <p className="mt-1.5 px-2 text-[11px] text-leaf/90">
                  {route.label} · {feed.length} favor{feed.length === 1 ? "" : "s"} nearby
                </p>
              )}
            </form>

            {!live && (
              <p className="absolute inset-x-3 top-[7.6rem] z-20 rounded-full bg-ink/75 px-3 py-1.5 text-center text-[11px] text-paper/70">
                Refreshing GPS…
              </p>
            )}

            {flash && (
              <div className="absolute inset-x-3 top-[7.8rem] z-30 rounded-2xl bg-leaf px-4 py-3 text-sm text-ink shadow-lg">
                {flash}
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 bg-gradient-to-t from-[#151c12] via-[#151c12]/90 to-transparent px-3 pb-2 pt-16">
              <div className="pointer-events-auto">
                <SwipeDeck
                  feed={feed}
                  index={index}
                  onIndexChange={setIndex}
                  onAccept={accept}
                />
                <p className="mt-2 px-1 text-[11px] text-paper/45">
                  {feed.length} favors · scroll · map follows
                </p>
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
              <div className="flex h-full flex-col overflow-hidden">
                <div className="shrink-0">
                  <ReciprocityChain chain={chain} />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProfilePanel session={session} tx={tx} onClose={() => setTab("map")} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-50">
          <BottomNav
            tab={tab}
            hasActive={Boolean(myClaim || pendingMine)}
            remainingLabel={timerLabel}
            onChange={(nextTab) => {
              if (nextTab === "you") {
                void apiMe(session.id)
                  .then((me) => {
                    saveSession(me.user);
                    setSession(me.user);
                    if (me.transactions.length) setTx(me.transactions);
                  })
                  .catch(() => undefined);
                void apiChain()
                  .then((data) => setChain(data.chain))
                  .catch(() => setChain(null));
              }
              setTab(nextTab);
            }}
          />
        </div>
      </div>
    </main>
  );
}
