# Quest — hackathon plan

Ship a demo judges can join from a QR in seconds. Couple of hours left. Build only what you can show on two phones. Everything else is a sentence at the table.

**Decisions:** no Google Maps · zones over GPS · mock data in the app · reputation tiers as labels, not a new system · cash stays out

| Do | Don’t |
|---|---|
| Widen the map and let people pan nearby neighborhoods | Google Maps, Mapbox, new tile vendors |
| Seed richer mock quests across those neighborhoods | Convex / Supabase / Auth0 tonight |
| Close the loop: take → timer → confirm karma | Event pipelines, paid tiers, chat, push |
| Deploy one HTTPS URL | Refactors, new frameworks |

> **Skip Google Maps.** Keys, billing, and ToS will eat the remaining hours. Dark OSM is already on the phone. Neighborhood scrolling is a bigger `maxBounds` plus chips — not a new map SDK.

Repo: [github.com/Grbmax/gotplacestobe](https://github.com/Grbmax/gotplacestobe)

---

## Already working (protect this)

Join with a name + zone, dark campus map, live/snapped pin, swipe to take or skip, details on the card, 5-minute claim timer, bail/done APIs, Post / Active / You tabs, karma escrow on create. Matching already ranks per viewer with a why line.

Do not rewrite this. Demo quality is a scored criterion. An ugly loop that works beats a new database that isn’t wired.

---

## Build list (hackathon only)

| Ship | What it is | Why a judge cares |
|---|---|---|
| Neighborhood pan | Wider envelope + chips: Campus, N Oakland, S Oakland, Shadyside, Squirrel Hill. Chip `flyTo`s. Matching still uses a minutes matrix, not GPS meters. | “Can I look around campus?” — yes, and it doesn’t jump 400m indoors |
| Mock board | 8–12 seeded quests in those neighborhoods, mixed urgency/karma | Feed never empty when someone walks up |
| Confirm | Requester taps confirm; helper gets karma; ledger line on You | That’s the economy, not a to-do list |
| Tier labels | Derive New / Neighbor / Regular from `completed` + `bailed` already on the session. Badge on You and on the card | Tracking without a new analytics stack |
| One live URL | Vercel (or any HTTPS). Printed QR. Second phone already joined | Ten-second join |

**If something slips, cut in this order:** tier badges → extra neighborhoods (keep Oakland + campus) → confirm (keep timer + “mark done”) → never cut the map or swipe.

---

## Maps

Indoor GPS stays a lie. Pan is a camera move. Matching stays named zones.

| Option | Hackathon |
|---|---|
| Leaflet + dark OSM (current) | **Keep** |
| MapTiler / Stadia / Mapbox | Don’t switch |
| Google Maps JS | Don’t. Needs Cloud billing, restricted keys, a full Leaflet rip-out, still snaps indoors |

**Neighborhoods to put on the chip row**

| Area | Example pins | Walk from Cut |
|---|---|---|
| CMU core | Hunt, Gates, Tepper 2/3, The Cut | 0–8 min |
| North Oakland | Craig / Centre | 8–15 min |
| South Oakland | Atwood / Bates | 10–18 min |
| Shadyside | Walnut | 15–25 min |
| Squirrel Hill | Forbes & Murray | 20–30 min |

Envelope roughly 40.428–40.462 N, 79.965–79.918 W. Viscosity 1 so the map cannot slide off the UI. Do not unbounded-pan all of Pittsburgh.

---

## Mock data (not a new database)

The in-memory store is enough for a table demo if **one process** serves both phones (local `next start` or a single Vercel deployment you don’t spam-redeploy). Seed the same shape you’d put in Convex later:

| Collection | Tonight | Later (don’t build) |
|---|---|---|
| `users` | Name, zone, karma 100, completed, bailed, derived tier | Andrew ID, Clerk |
| `quests` | title, zone, neighborhood, urgency, escrow, status, claimedAt | TTL indexes, 30 neighborhoods |
| `transactions` | Append on post + confirm | Full ledger export |
| `events` / `reports` | Skip | Tracking warehouse |

**Lean online DB when you have a real night, not this one:** Convex (TypeScript, live feed, seed script) or Supabase. Same documents. Don’t stand it up unless the two-phone loop is already green and someone is idle.

---

## Favor economy — what to show vs invent

Timebanks die because people hoard credits and won’t ask. Quest already fights that: free to ask, starting 100, one tap, in the moment.

| Tier | Rule (use fields you have) | Show | Don’t |
|---|---|---|---|
| New | completed &lt; 3 | Default | Hide quests from new users |
| Neighbor | 3+ confirms, low bailed | Badge + why line | Paywall “see first” |
| Regular | 12+ confirms | Badge | Force people to ask |
| Anchor | Skip for the demo | Say “campus orgs later” | God-mode admin |

**Tracking you can fake honestly:** karma in/out on You (you already have transactions), completed vs bailed, “quests nearby” count. **Don’t build:** event log, dashboards, decay, streaks.

Karma rules to say out loud: escrow on post, only requester confirms, bail puts it back on the map and hurts rank. No Venmo for a charger walk.

---

## Integrations

| Need tonight | Skip |
|---|---|
| Next.js on HTTPS (Vercel) | Expo, native apps |
| Existing `/api/*` + in-memory seed | Convex, Mongo, Firebase |
| Leaflet OSM | Google Maps, Mapbox |
| localStorage session | Auth0, Clerk, Andrew login |
| Polling you already have | Sockets, web push, Sentry, Stripe, Redis |

---

## Table demo

1. QR → name → zone → map with pings.
2. Pan a neighborhood chip. A mock quest is sitting there.
3. Second phone: different feed order, why line.
4. Take it. Timer starts. Confirm on the first phone. Karma moves.
5. Line for judges: useless with one person; routing is the hard part; we designed against timebank hoarding.

Don’t say favor marketplace, Uber for favors, blockchain, AI-powered.

---

## What to tell the team

We are not adding Google Maps or a new database. We widen the dark map to nearby neighborhoods, seed mock quests there, stamp a reputation tier from existing stats, and close confirm so karma visibly moves. If we only finish the map pan and a full seed, we still have a demo.
