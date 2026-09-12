# QUEST — Steering Doc
**This file is the constitution. QUEST-CONTEXT-DUMP.md and QUEST-TECH.md are history — read them for *why*, obey *this* for *what's allowed today*.**

Written 2026-09-12, submission day, ~6h+ remaining before 16:00. Supersedes any verbal "let's also add X" said after this point unless it's logged in §7.

**`QUEST-ROADMAP.md` is retired as of the merge logged in §7 — it briefly existed as a second, independently-written plan doc. Everything worth keeping from it lives in §4B and §5 now. If you have it open in a tab, close it and use this file instead.**

---

## 0. How to use this file (for humans and for Cursor / Claude Code)

- **Before adding a dependency, a sponsor integration, a new screen, or touching a file you don't own** → check §3's gate, then check your sponsor's verdict in §5. If it says SKIP, don't build it — don't let an agent talk you into it either.
- **Before an AI coding agent (Cursor, Claude Code) makes a change bigger than a bugfix** → paste it the relevant section of §5 or §4 as its task, not a vague "add MongoDB" — vague prompts are exactly how this explodes.
- Every deviation from this doc gets one line in §7, even a good one. Silent drift is how "zones, not GPS" quietly became a full Leaflet map (see §2) — that particular drift turned out fine, but it was luck, not process.

---

## 1. Locked scope (unchanged from QUEST-TECH.md)

Four screens (Join · Feed · Create · Wallet), eight-endpoint API, karma escrow, deterministic score (never call it AI), zones-based distance. **Cut, still cut:** leaderboard, chat, profiles, push notifications, real payments, blockchain. Full detail lives in QUEST-TECH.md §0–§6 — not repeated here.

---

## 2. Reality check — audit as of now

Read this before touching anything. Two of these are bugs, not style opinions.

| # | Finding | Severity | Verdict |
|---|---|---|---|
| 1 | **`/api/quests/:id/confirm` does not exist.** `store.ts` has `createUser`, `listQuests`, `createQuest`, `claimQuest`, `bailQuest`, `markDone`, `getMe` — no `confirmQuest`. A quest can reach `PENDING` and then never move to `CONFIRMED`. Karma escrow is never released to the helper. **This is the core loop, and it's incomplete.** Independently flagged by a teammate in the now-retired `QUEST-ROADMAP.md` build list — two people finding the same gap without coordinating is a strong signal it's real. | **P0** | Fix before anything else in §4. |
| 2 | **The store is a module-level in-memory array/Map** (`const quests: Quest[] = ...`, `const users = new Map()`). On Vercel this lives per serverless instance — a second warm lambda, a cold start, or a redeploy silently resets or forks state. It also makes "never wipe the seeded database" (your own non-negotiable) unenforceable, because there is no database. | **P0** | Fixed by the MongoDB swap in §5. |
| 3 | **The campus map is a real Leaflet + OpenStreetMap tile layer with real CMU lat/lng**, not the flat named-zone list QUEST-TECH.md §0.2 called for. This already shipped (`d3ffb2f`, `274ec86`) and looks good in the screenshots. | Informational | **Keep it — do not re-litigate.** It demos better than a schematic and it isn't broken. But this is exactly the kind of unlogged scope change this file exists to catch next time. Zone-to-zone distance still comes from the hand-written matrix in `lib/data.ts`, not from GPS — that part of the original decision held. Don't let it start driving matching. |
| 4 | No `.env`, no DB driver, no Gemini/ElevenLabs/Auth0/Vultr SDK in `package.json` yet. | Informational | Every sponsor section below is starting from zero — none of this is half-done, so there's no salvage work, only build work. |

---

## 3. The change-control gate

Before writing code for anything not already in §1, answer these four questions. If you can't answer all four in one sentence each, you're not ready to start.

1. **Which bundle does this touch?** (A: shell/routes, B: store/data, C: score, D: client — see QUEST-TECH.md §7). If it touches more than one, it needs a person from each, not a solo agent sweep.
2. **What's the time-box?** If it has no stated end time, it has no end time in practice.
3. **What's the fallback if the external call fails or is slow at the table?** ("nothing, it just breaks" is not an answer — every sponsor integration below must degrade to the pre-sponsor behavior, not a broken screen.)
4. **Is it visible to a judge in 3 seconds, or is it invisible cleverness?** (Your own win analysis, QUEST-CONTEXT-DUMP.md §3.2. Invisible cleverness scores zero — don't spend an hour on it today.)

---

## 4. Fix-first list (before any sponsor work)

1. **Implement `confirmQuest` + `POST /api/quests/:id/confirm`.** PENDING → CONFIRMED, credit helper, write Transaction, per QUEST-TECH.md §3. ~20 min, Bundle A+B. Nothing else here matters if this doesn't exist — it's the karma transfer that's the entire pitch.
2. Do the MongoDB swap (§5) right after, since it's the real fix for finding #2 above and it's already the highest-value sponsor pick.

---

## 4B. Approved core additions (merged from QUEST-ROADMAP.md)

`QUEST-ROADMAP.md` was retired into this file — see §7. These three were independently proposed there by a teammate and are approved, run through the §3 gate below rather than copy-pasted in as-is.

1. **Neighborhood pan.** Widen the map's `maxBounds` to roughly 40.428–40.462 N, 79.965–79.918 W (CMU core out through Oakland/Shadyside/Squirrel Hill) and add a chip row (Campus, N Oakland, S Oakland, Shadyside, Squirrel Hill) that `flyTo`s each area. Matching still runs off the hand-written minutes matrix in `lib/data.ts`, extended with entries for the new areas — **never GPS meters**, that decision still holds. Keep `maxBoundsViscosity: 1` so the map can't slide off-screen.
   - Bundle: D (map component) + B (extend zone/minutes data). Time-box: 30 min. Fallback: ship with campus-only bounds — the chip row is additive UI, nothing else breaks if it's cut. Visible in 3 seconds: yes ("can I look around campus?" — yes, and it doesn't jump 400m indoors).
2. **Mock board.** Seed 8–12 quests across the new neighborhoods with mixed urgency/karma so the feed is never empty when a judge walks up.
   - Bundle: B (`MOCK_QUESTS` / seed data). Time-box: 15 min. No fallback needed — pure data.
3. **Tier labels (New / Neighbor / Regular).** Derive from `completed`/`bailed` already on `Session` — no new fields, no new system. Badge on Wallet and on quest cards. **Skip "Anchor" entirely** — say "campus orgs later" if a judge asks, don't build it.
   - Bundle: D only (pure display logic off existing fields). Time-box: 20 min. Fallback: just don't render the badge if the derivation throws — never block the screen on it.

**Cut order if time runs out**, carried over from the original proposal: tier badges first, then extra neighborhoods (keep campus + one Oakland chip), then — everything else before touching confirm. Confirm is P0 per §4 and is never cut, full stop; the map and swipe interaction are never cut either.

---

## 5. Sponsor steering — one verdict per sponsor, no ambiguity

Source: [MLH HackCMU prize page](https://www.mlh.com/events/hackcmu/prizes), cross-checked against what's actually installed.

### Google — Gemini API → **DO**
- **Not** Google Maps. Google Maps Platform isn't a judged category here — only "Best Use of Gemini API" is — and swapping a working, keyless Leaflet/OSM map for a billed, API-keyed Google Maps embed is real risk (quota, CSP, key exposure) for zero prize upside. Keep the map exactly as it is.
- **What to actually build:** a natural-language quest composer on the **Create** screen. User types (or later, speaks) *"need someone to grab my charger from Hunt, kind of urgent"* → one Gemini call extracts `{title, zone, urgency}` → pre-fills the form → user confirms → pin drops on the existing map. This is the "gemini AI for the map thingy" you were picturing, without touching map rendering.
- Why this and not using Gemini for the matching score: QUEST-TECH.md is explicit — *"deterministic... never call it AI."* Gemini stays on the translation layer (free text → structured fields), never the engine. That's also the exact pattern that won last year (QUEST-CONTEXT-DUMP.md §3, point 5: "the LLM translates; it isn't the engine").
- Scope: one new API route (`/api/quests/parse`), Bundle A+D only. Fallback: if the call fails or is slow, the manual form fields are still right there, untouched — nothing about Create breaks.
- Time-box: 45 min. Visible in 3 seconds: yes — "watch, I just typed a sentence and it filled the form and dropped the pin."

### ElevenLabs — **DO**
- Primary use, per your own plan: narrate the **product demo video** recorded at the end of the night. This is the safest possible sponsor integration — it touches zero app code, zero demo risk, pure post-production.
- Optional stretch, only if the Gemini feature ships early and someone's idle: a "read this quest aloud" button on a Feed card (`ElevenLabs TTS` on the `title`/`detail` string). Nice-to-have accessibility flavor, not load-bearing. Cut without hesitation if it eats into video time.
- Time-box: video narration has no cap (it's the deliverable), stretch feature capped at 30 min.

### MongoDB Atlas — **DO** (you flagged this yourself, correctly)
- This isn't just a sponsor prize, it fixes finding #2 in §2. Swap **only the internals of `lib/store.ts`**, per the seam QUEST-TECH.md §7 already designed for this ("store.ts function signatures frozen, internals are free"). `lib/db.ts` gets the Mongo client. Nobody else's files change.
- Order matters: do the `confirmQuest` fix (§4.1) against the in-memory store first, then swap storage under it — don't do both at once, you won't be able to tell which change broke what.
- Time-box: 60 min. Fallback: keep the in-memory version in git history — if Mongo setup stalls past the time-box, revert `store.ts` and ship in-memory for the demo table, migrate later.
- **Team disagreement, logged, not silent:** the now-retired `QUEST-ROADMAP.md` argued for skipping Mongo tonight entirely — its position was that in-memory is fine for a table demo as long as one pinned deployment serves both phones (no spam-redeploys). That's a reasonable position. The call was made anyway to keep Mongo in tonight's plan (see §7). Practically this means the roadmap's position *is* the fallback if the time-box above is blown — reverting to in-memory costs nothing extra since it was already going to work for the demo either way.

### Auth0 — **OPTIONAL, gated**
- Exactly as QUEST-TECH.md already decided: "sign in to keep your karma," added *after* the core loop (§4 fix + Mongo swap) is verified working end-to-end on two real phones. Never in front of Join — a login wall in front of the ten-second join is self-sabotage, your words, still true.
- Gate: don't start this until the P0 list in §4 is done and tested. If you're behind schedule when that gate opens, skip it — it's the first thing cut, not the last.
- Time-box: 45 min.

### Vultr — **OPTIONAL, stretch**
- `lib/score.ts` was already designed as a zero-import pure function ("it can be written on a plane," QUEST-TECH.md §7 Bundle C). That's precisely what's cheap to lift into a tiny Node service on Vultr, called over HTTP from the feed route instead of a local import.
- Only start this if someone is genuinely idle after everything above ships. Fallback: feed route tries the Vultr call, falls back to the local `lib/score.ts` import on any error/timeout — the demo must never depend on Vultr's uptime.
- Time-box: 40 min, per the original plan.

### Solana — **SKIP. Do not reopen.**
- Already cut in QUEST-TECH.md §1 ("Cut entirely: Solana") for good reason: it has nothing to do with reciprocal favours, and bolting on a wallet/token for prize-shopping reads as exactly that to a judge scoring "originality." If anyone pitches it today, point them at this line and move on.

---

## 6. Suggested order for the rest of today

Not clock times (I don't know what time it is right now) — just sequence, each with its own box from above. Reserve the **last 2 hours before 16:00** for submission copy, track selection off the overnight tally, and the two-person-two-phones test, no matter where you are in this list when that window opens.

1. `confirmQuest` + `/confirm` route (§4.1) — the loop isn't real without it.
2. MongoDB swap (§4.2 / §5).
3. Two-phone end-to-end test: post → claim → done → confirm → karma actually moves. Don't proceed past this until it's green.
4. Mock board seed + neighborhood pan (§4B.1–2) — can run in parallel with step 4 below if you have two people free.
5. Gemini composer (§5).
6. Tier labels (§4B.3) — lowest-priority approved item, first thing cut if behind.
7. Record the ElevenLabs-narrated demo video **while the app definitely works** — don't wait until it's shaky.
8. Auth0, only if still ahead of schedule.
9. Vultr, only if someone is still idle after that.
10. Submission window — copy, track choice, buffer.

---

## 7. Amendment log

Every deviation from §1/§5 gets a line here, so drift is visible instead of discovered later.

| Time | Change | Why | Logged by |
|---|---|---|---|
| (backfilled) | Shipped a real Leaflet/OSM map instead of the flat zone list | Demos better, and the team built it before this doc existed | steering doc audit |
| 2026-09-12 | A teammate independently pushed `QUEST-ROADMAP.md`, a second competing plan doc, minutes after this file was first committed | Two people wrote "the plan" at once without coordinating — the exact drift this file exists to catch | steering doc audit |
| 2026-09-12 | `QUEST-ROADMAP.md` merged into this file and retired; its neighborhood-pan, mock-board, and tier-label proposals folded into §4B | Team decision: one steering doc, not two | user + steering doc |
| 2026-09-12 | Kept MongoDB in tonight's plan (§5) despite `QUEST-ROADMAP.md` recommending skip-tonight | Team decision, made consciously rather than by whichever doc someone had open | user |
| 2026-09-12 | Added `mongodb` npm dependency for Atlas/local store swap (§5) | Required driver for `lib/db.ts` / `lib/store.ts` internals | agent |
| 2026-09-12 | A teammate (Vidushi, via Cursor) shipped a "live-anywhere" map: `ZoneId` changed from real CMU zones to generic placeholders (`plaza/cafe/library/park/gym`), quests now carry optional `lat`/`lng`, and new `/api/places` + `/api/directions` routes add Photon place-search and walking routes | This directly reopens the "zones, not GPS, never let it drive the demo" decision (QUEST-TECH.md §0.2, reaffirmed in the retired `QUEST-ROADMAP.md`) without going through this doc first — `lib/types.ts` is supposed to be frozen and change-announced | steering doc audit |
| 2026-09-12 | Reconciled: rebased the MongoDB store swap onto the live-anywhere commit rather than picking one — `store.ts` is now Mongo-backed *and* carries the lat/lng jitter on `createQuest`; `asQuest` now maps lat/lng through. Also fixed a real bug surfaced while touching `bailQuest`: it was incrementing the helper's `bailed` counter before confirming the quest update succeeded, so two near-simultaneous bail requests could double-count it. Reordered to gate the increment behind the atomic quest update, matching the pattern already used in `claimQuest`/`confirmQuest`. | User asked to resolve and push rather than pick a side; both features verified together (typecheck, lint, `next build`, and a live post→claim→done→confirm loop against real Mongo with the new zone ids) before pushing | user + agent |
| 2026-09-12 | First Vercel deploy failed in production with `MongoServerSelectionError` / TLS "alert number 80" on every request, even after Atlas Network Access was confirmed correctly set to `0.0.0.0/0` (Active). Root cause was Vercel's serverless functions routing to Atlas over IPv6, which Atlas's TLS layer rejects as a garbled handshake rather than a clean error. Fixed by forcing `family: 4` on the `MongoClient` constructor in `lib/db.ts`. Verified with a full post→claim→done→confirm loop against the live production URL before calling it done. | Production-only failure that didn't reproduce locally or in `next build` — worth recording so nobody re-diagnoses this as an allowlist problem again | agent |
| | | | |

---

## 8. Non-negotiables (carried forward + new)

- Not on a live URL → cut it. No new mechanics after now. Nobody refactors for style today.
- **Never wipe the seeded database** once Mongo is live — the overnight usage numbers are the pitch (QUEST-CONTEXT-DUMP.md §9).
- No npm dependency lands without a line in §7.
- Every sponsor integration must degrade gracefully — a slow or dead external API must never blank a screen. If you can't state the fallback, don't ship the integration yet.
- Only Bundle A touches `package.json`. Still true, still the most common 3am conflict.
