# Quest — production plan

Favor economy for CMU and the neighborhoods around campus. Keep the current mobile-web loop. Do not wait on Google Maps. Persist mock data in a lean hosted DB now so the schema is the same when real users show up.

**Decisions:** skip Google Maps · zones over raw GPS · Convex or Supabase for data · reputation tiers, not paid ranks

| Horizon | Target |
|---|---|
| Now | In-memory + seed quests |
| 2 weeks | Hosted DB + neighborhoods |
| 4–6 weeks | Auth, confirm, tracking |
| 8+ weeks | Safety, orgs, production |

> **Do not import Google Maps for the next phase.** Carto already broke the demo with “API KEY REQUIRED.” Google has the same problem, plus a billing account, referrer-locked keys, and ToS that forbid using their tiles through Leaflet. Keep dark OSM (what we have) or MapTiler. Expand bounds so people can pan Oakland / Shadyside / Squirrel Hill. Google is an optional later swap, not a blocker.

---

## What is already shippable

Join without login, zone pin, dark campus map, swipe to take, 5-minute claim timer, bail/done APIs, quick post, profile/karma. Matching is per-viewer (proximity, urgency, reward, reliability) with a visible why line. That is the product. Everything below hangs off this loop.

Repo: [github.com/Grbmax/gotplacestobe](https://github.com/Grbmax/gotplacestobe)

---

## Maps — stay off Google

Indoor GPS will still lie on Tepper 3F. Neighborhood panning is a camera feature. Matching should keep using named zones and a minutes matrix, not meter distance.

| Option | Cost | Dark style | Pan neighborhoods | Verdict |
|---|---|---|---|---|
| Leaflet + OSM (current) | Free | CSS invert on tiles | Widen maxBounds; neighborhood chips flyTo | **Keep. Zero keys.** |
| MapTiler / Stadia dark | Free tier, then cheap | Native dark raster/vector | Same Leaflet code, swap tile URL | Best visual upgrade |
| Mapbox GL | Generous free, then billed | Excellent dark styles | Easy, heavier bundle | Only if you want 3D later |
| Google Maps JS | Cloud billing required | Cloud-based map styles | Easy, but key + ToS + logo | Defer |

### Neighborhoods to unlock (pan, don’t GPS-match)

| Area | Role | Example zones | Walk from Cut |
|---|---|---|---|
| CMU core | Default envelope | Hunt, Gates, Tepper 2/3, The Cut | 0–8 min |
| North Oakland | Student housing density | Craig, Centre, Bayard | 8–15 min |
| South Oakland | Evening / weekend volume | Atwood, Bates, Semple | 10–18 min |
| Shadyside | Retail / coffee asks | Walnut, Ellsworth | 15–25 min |
| Squirrel Hill N | Forbes corridor | Murray, Forbes & Shady | 20–30 min |
| Schenley / Panther Hollow | Park / outdoor | Phipps edge, Hollow trail | 10–20 min |

**Implementation:** replace `CAMPUS_BOUNDS` with a service-area envelope (roughly 40.428–40.462 N, 79.965–79.918 W). Add a chip scroller: Campus · N Oakland · S Oakland · Shadyside · Squirrel Hill. Chip calls `map.flyTo`. Matching still filters by `minutesAway <= N` (start with 25). Never let the map unbounded across Pittsburgh — that recreates the overlay-escape bug.

### If you later want Google Maps

| Step | What it takes | Risk |
|---|---|---|
| Google Cloud project + billing | Credit card on file even to use the monthly credit | Keys leak = surprise invoice |
| Enable Maps JavaScript API | Optional: Places, Geocoding. Restrict key to Vercel domains | Localhost + prod need separate referrer rules |
| Replace Leaflet | `@vis.gl/react-google-maps`, dark cloud style, custom zone overlays | 1–3 days. Cannot keep OSM tiles under a Google map |
| Dark mode | Cloud Map Styling in the Google console | Must keep Google logo and ToS attribution |
| Still does not fix indoor GPS | You would still snap to Hunt / Gates / Tepper indoors | Google does not make the demo more honest |

**Recommendation:** do not include Google. Spend the same two days on neighborhood bounds, a hosted DB, and requester confirm. If a sponsor later gifts Maps credits, swap the tile layer behind a `MAP_PROVIDER` env flag.

---

## Lean database — mock now, real later

Today quests live in a server memory Map. That resets on every serverless cold start and cannot be shared across phones reliably. Pick a hosted store whose documents look like production on day one. Seed 20–40 fake quests; flip a flag when real users write the same collections.

| Store | Fit for Quest | Mock path | When it hurts |
|---|---|---|---|
| **Convex** | Best DX. TypeScript schema, live queries (kill 2s polling), free tier | `convex/seed.ts` writes the same tables as prod | Less “classic SQL” if you later hire a data person |
| Supabase (Postgres) | Auth + RLS + SQL. Closest to a real company stack | `supabase/seed.sql` + a demo project | Realtime needs more wiring than Convex |
| MongoDB Atlas | Already in the hackathon spec / sponsor prize | A seed collection + TTL indexes on claims | Easy to get schemaless and messy |
| Firebase / Firestore | Fine for mobile later | Emulator suite | Security rules are easy to get wrong |

**Pick: Convex now, Postgres if you incorporate.** For the next four weeks use Convex. One TypeScript codebase, seeded mock users, live quest feed, claim expiry as a scheduled function. If you raise money or need BI, dump Convex → Postgres/Supabase. Do not run both. PocketBase is a fine laptop toy; skip it for anything two phones need to share over HTTPS.

### Collections to create once (mock and prod identical)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | name, neighborhood, zone, karma, completed, bailed, tier, andrewId? | Start karma 100. Never let karma block asking. |
| `quests` | title, detail, zone, neighborhood, urgency, escrow, status, claimedAt, helperId | TTL/cron releases CLAIMED after 5 min |
| `transactions` | from, to, amount, questId, reason | Append-only ledger. This is the economy. |
| `events` | userId, type, at, payload | Tracking: viewed, skipped, claimed, bailed, confirmed |
| `reports` | questId, by, reason | Needed before you leave the building |

---

## Favor economy — tiers and tracking

Timebanks die because people hoard credits and stop asking. Quest already counters that: free to ask, starting balance, one-tap, in the moment. Tiers must reward circulation and reliability, not sitting on karma or paying for rank.

| Tier | How you get it | What it changes | What it must not do |
|---|---|---|---|
| New | Joined, &lt; 3 confirms | Full feed. Starting 100 karma | Do not hide urgent quests from New users |
| Neighbor | 3 confirms, bail rate &lt; 30% | why line mentions reliability; slight score bump (already 0.15) | Do not unlock “see quests first” as a paywall |
| Regular | 12 confirms, asked at least twice | Can post in adjacent neighborhoods; badge on card | Do not require asking — that recreates hoarding shame |
| Anchor | Campus org or 40 confirms, low bail | Can seed building-wide asks | Not moderator god-mode. Reports still go to a human. |

### Tracking worth building

**Per person:** confirms, median post→claim minutes, bail rate, karma in vs out (circulation), neighborhoods helped, current streak. Surface 2–3 of these on You — not a LinkedIn profile.

**Per building / night:** joins, open quests, completes, median time, % that expired unclaimed. This is the pitch dashboard and later the operator view.

**Karma design rules:** escrow on create. Only the requester confirms. Bail returns the quest to OPEN and increments bailed (hurts feed rank). Add a slow karma decay on unspent balances above 200 so hoarding is slightly stupid. Never add Venmo for a charger walk — cash friction is the point.

---

## Features to add (in order)

| Priority | Feature | Why |
|---|---|---|
| P0 | Requester confirm screen | Without it karma never actually moves in a two-phone loop |
| P0 | Hosted DB + seed | Two phones / Vercel instances must share one board |
| P0 | Neighborhood pan + zone matrix | Scroll past campus; keep matching zone-based |
| P1 | Optional sign-in to keep karma | Andrew email or Google. Demo join stays nameless |
| P1 | Event log + You stats | Tiers need facts, not vibes |
| P1 | Report + block | Campus safety before scale |
| P2 | Categories (carry, hold, swap, find) | Makes the feed scannable |
| P2 | Quiet hours / zone capacity | Stop 40 people getting pinged for one HDMI |
| P3 | Org accounts, lost-and-found, web push | After the loop is boringly reliable |

---

## Production integrations

| Layer | Use | Skip / later |
|---|---|---|
| Host | Vercel (HTTPS for geo + QR) | Skip Expo until you have a reason |
| Data | Convex (or Supabase) | Skip dual-writing Mongo + Convex |
| Auth | Clerk or Auth0, optional | No login wall on first open |
| Maps | Leaflet + OSM or MapTiler | Google, Mapbox 3D |
| Realtime | Convex subscriptions or keep 2s poll | WebSockets on venue wifi |
| Jobs | Convex cron for 5-min expiry | Manual TTL in app only |
| Email | Resend for “keep this karma” magic link | SMS until you have a campus deal |
| Observe | Sentry + Vercel Analytics | Datadog until traffic exists |
| Rate limit | Upstash Redis on POST /quests | After first spam incident is too late |
| Moderation | Report table + Slack webhook | AI classifiers |
| Payments | None | Stripe, Solana, “Uber for favors” |

---

## Build sequence

1. Stand up Convex (or Atlas). Port User / Quest / Transaction. Seed 30 mock quests across 6 neighborhoods. Point `GET /api/quests` at it.
2. Widen service-area bounds, add neighborhood chips, handwritten minutes matrix between neighborhoods. Matching still ignores GPS meters.
3. Requester confirm + refund-on-cancel. Ledger writes on CONFIRMED. This is the economy.
4. Optional Clerk/Auth0. Anonymous session can merge into an account. Andrew ID later.
5. `events` collection. You tab: confirms, bail rate, karma in/out. Operator stats page for overnight numbers.
6. Derive New / Neighbor / Regular / Anchor from events. Badge on cards. Reliability stays a 0.15 weight, not a paywall.
7. Report, block, hide exact helper GPS, public zone only. Rate-limit posts.
8. Sentry, custom domain, MapTiler key if OSM looks tired, privacy page, campus ToS. Load-test 200 polling clients.

---

## What to tell the team

We are not adding Google Maps. We are expanding the dark map to nearby neighborhoods with chips, and we are putting mock data in Convex (same schema we will keep). Tiers are reputation from confirms and circulation, not a paid ladder. Tracking is an append-only event log. Cash stays out.
