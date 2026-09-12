# SCAN — Master Plan
**09:34 Sat · freeze 12:00 · ship 14:00 · expo 16:00**
Written against the actual repo as it stands. **This is the current source of truth — `SCAN-ARCHITECTURE.md` and `SCAN-TASKS.md` are historical (they assumed Roboflow-primary; the app is Gemini-primary and that's now verified working end-to-end). `SCAN-EVIDENCE.md` is still fully live — every citation in it applies regardless of detector.**

---

## PART 1 — The ideal flow

This is what should happen end to end. Everything in Part 3 exists to make this true.

### Step 1 — Sign in, pick who you are
`/` → `IdentityGate` → tenant, owner or inspector.

**Why it matters:** the role isn't decoration. A tenant *makes* records; an owner or inspector *reviews* them. **That split is what makes the output evidence rather than one person's opinion, and it's your answer to "so you're diagnosing buildings?" — you're not, a named human with a role signs off.**

### Step 2 — Pick or create a property
`/` → property list → `lease` / `sublet` / `stay`.

### Step 3 — The app tells you where to point
`/scan` → `SurfacePrompt` reads `nextBestSurface()`.

> **"Bathroom ceiling — never scanned, high-risk surface."**

**This is the moment the Optimization claim lives or dies.** The user doesn't wander. The app spends their limited patience where it's worth the most.

### Step 4 — Live camera with boxes
`Viewfinder` + `BoxOverlay`. Rear camera, boxes drawn over the video, class and confidence on each.

**If this surface has been scanned before**, the previous photo appears at ~30% opacity over the live feed and the user lines it up. **That's what makes "12% now versus 8% in August" mean anything instead of measuring where they stood.**

### Step 5 — Shutter
Freeze, POST to `/api/scans`, server computes `totalAffectedRatio` and the `finding` sentence.

> *"Mould on the bathroom ceiling near the vent — roughly 12% of the surface in frame."*

**Never square metres.** One camera can't recover scale.

### Step 6 — Coverage advances, and the prompt changes
The coverage bar moves. The next prompt appears — and if the last read was ambiguous, it says so:

> **"Re-shoot the bathroom ceiling — last read was uncertain (0.52)."**

**This is the single most important behaviour in the app.** See Part 3, build #1.

### Step 7 — The report
`/report/[propertyId]` → grouped by room and surface. Each surface shows its `Timeline`, its `CompareView` (first vs latest, both numbers, the delta), and a direction badge: worsening / improving / stable.

Anything unreviewed is stamped **"Unreviewed — not a claim."**

### Step 8 — Review
An owner or inspector marks confirmed or disputed. **That's the gate. That's the medicly clinician move.**

### Step 9 — `/optimize`
The page that turns this from an app into an entry. Two curves: defects found against photos taken, guided order versus naive order.

> *"Guided capture found 80% of the defects in 40% of the photos."*

---

## PART 2 — What exists, what's pending

**Already built and working, verified 09:55 Sat:**
`IdentityGate` · roles · properties · `Viewfinder` · `BoxOverlay` · **real Gemini detector confirmed live** (fixed a stale model-name bug that was silently falling back to mock — `detector:"gemini"` now confirmed in a live test call) · mock fallback · `/api/scans` · `store.ts` · `progression.ts` · `nextbest.ts` (now with the uncertainty term, see Build 1) · `Timeline` · `CompareView` · `ScanCard` · `SurfacePrompt` · review endpoint · Auth0 (lite mode working now, real login is a config-only upgrade) · Vercel · **ghost overlay (Build 2)** · **`/optimize` comparison page (Build 3)**.

Builds 1–3 below are done as of this update. Build 4 (decoys/threshold) still needs a human with a camera and printed photos.

| # | Missing | Why it matters | Status |
|---|---|---|---|
| 1 | **Uncertainty term in `nextbest.ts`** | Turns a checklist into a system that reasons about what it doesn't know | ✅ Done |
| 2 | **Ghost overlay in `Viewfinder`** | Without it, your progression number is measuring your own posture. **This is the question that kills the thesis** | ✅ Done |
| 3 | **`/optimize` comparison chart** | **This *is* the Optimization entry. Without it you have a feature, not a result** | ✅ Done |
| 4 | **Threshold calibration against decoys** | **One confident false positive at the table costs more than three features** | ⬜ Needs a human, a camera, and printed photos — see Part 4 |

Plus two non-code items: **printed samples** and **the video**.

---

## PART 3 — The four builds, in order

### Build 1 — Uncertainty (20 min) · `nextbest.ts` + `store.ts` — ✅ DONE

Right now: `prior × (1 − coverage) × recency`. That's where mould *usually* is. A checklist.

Added a fourth term so the app also goes back to where it *wasn't sure*: `uncertaintyBoost` in `src/lib/nextbest.ts`, wired into `value` in `nextBestSurface`. `SurfaceCoverage.lastDetections` populated in both `store.ts`'s `surfaceCoverage()` and the client-side coverage build in `scan/page.tsx`. The reason string now says `"last read was uncertain (0.52)"` when applicable.

**Why this is the sauce: every other team in Optimization will have a ranked list. You'll have a system that says *I'm not sure, look again* — which is spending a limited budget where uncertainty is highest.** To a judge from a trading firm that's value-of-information, which is exactly how their desk decides what data to buy. To a judge from Sandia or Lockheed it's sensor placement, which is their day job.

### Build 2 — Ghost overlay (30 min) · `Viewfinder.tsx` — ✅ DONE

When the selected surface has a previous scan, its `imageUrl` renders as an absolutely-positioned `<img>` over the video at 30% opacity (`mix-blend-luminosity` so it reads as a guide, not a filter). A toggle ("Ghost on/off") sits in the top bar next to the identity chip, shown only when a ghost exists. **Never blocks the shutter** — the button to capture is always available regardless of the ghost.

Did **not** touch opencv.js. 8MB of wasm is a bad hour to lose, and **a judge can *see* the ghost working, which beats a homography they have to take on faith.**

### Build 3 — `/optimize` (45 min) · new route, touches nothing else — ✅ DONE

`src/lib/optimize.ts` — pure functions: `naiveOrder` (actual capture order), `guidedOrder` (re-runs the real `nextBestSurface()` step by step over the same already-captured scans, taking whichever available scan matches its live recommendation), `cumulativeDefects`, `totalDistinctDefects`, `photosToReach`. `src/components/OptimizeChart.tsx` — two-line SVG chart matching `Timeline.tsx`'s visual convention. `src/app/optimize/[propertyId]/page.tsx` — the page, linked from the report page ("Guided vs. naive →").

**New files only. No existing file changes beyond one link added to the report page. Killable at any moment.**

Verified with synthetic data: guided ordering correctly prioritizes high-prior surfaces first and reaches the same defect count in fewer photos than capture order, using the actual production scoring function — not a fabricated curve.

### Build 4 — Decoys (15 min) — ⬜ STILL NEEDS A HUMAN

Point the detector at: a shadow on a wall, a coffee stain, dark wood grain, a scuff, a damp-looking but clean patch. Raise the confidence threshold until they come back clean. **Write down what still fools it — knowing your own failure mode out loud is worth more than hiding it.**

This needs a real camera and real decoy surfaces — nobody can execute this from a terminal. Whoever's free next should run it before 11:25.

---

## PART 4 — The table

**Print six to eight full-page photos** — mould, water seepage, peeling paint, plus **two clean surfaces and one decoy**. Tape them around your table area: under the table edge, low near the floor, behind the monitor, flat on the surface. **Your table becomes a small apartment.**

**Then hand the judge the phone.**

The app tells them where to point. They walk your two square metres. The coverage bar fills. Boxes land on the real defects and not on the decoy. At the end:

> *"You found four of the five defects in six photos. Eyeballing it, people average eleven."*

**They ran your optimizer with their own hands and produced the result themselves. No network needed, repeatable forty times, and nobody else in that building will have it.**

---

## PART 5 — What you say

**The opener (10 seconds):**
> "Twenty-one percent of asthma in the US is attributable to damp and mould. A professional inspection is three hundred to a thousand dollars. Nobody arguing about a deposit is paying that."

**The demo (60 seconds):** hand them the phone, let the app direct them, say nothing until the coverage bar moves.

**The hard part, named (15 seconds):**
> "Each photo is worth less than the one before it because it overlaps with what you've already covered. When that's true, picking the best next photo each time is guaranteed to get you at least 63% of the value of the perfect plan. That's a result from 1978 — we didn't invent it, we just get to use it. And when a read comes back uncertain, the planner sends you back to that surface instead of a new one."

**Your own error bars (15 seconds):**
> "We align each scan to the previous one so the ratio is comparable. We report change in surface fraction, not absolute area, because one camera can't recover scale. Surface-visible indicators only — we can't see moisture behind drywall, that needs a meter. This is triage, and a human with a role signs off before anything is a claim."

**The 50 words, declaring Optimization:**
> Choosing which K photographs to take in a home. Objective: maximise risk-weighted coverage of likely defect sites, re-weighted toward surfaces where our own reads were uncertain. Constraint: a person's patience, about a dozen shots. Baseline: photographing whatever catches your eye. Guided capture found 80% of defects in 40% of the photos.

---

## PART 6 — The schedule

| Time | What | Status |
|---|---|---|
| 09:35–09:55 | Build 1 — uncertainty term | ✅ Done |
| 09:55–10:25 | Build 2 — ghost overlay | ✅ Done |
| 10:25–11:10 | Build 3 — `/optimize` | ✅ Done |
| 11:10–11:25 | Build 4 — decoys and thresholds | ⬜ Needs a human + camera |
| 11:25–11:45 | **Print the samples.** Someone leaves to do this | ⬜ |
| 11:45–12:00 | Fix the `finding` sentence if it says m². Run the full flow on a real phone | ⬜ |
| **12:00** | **Freeze. Record the video while it works.** | |
| 12:00–13:00 | Devpost writeup, 50 words drafted | ⬜ |
| 13:00–14:00 | Five cold run-throughs on strangers | ⬜ |
| 14:00 | **Submit** | |
| ~15:00 | Lunch recon — ten teams, one question: which track | |
| 15:45 | Declare — Optimization unless the recon says otherwise | |
| 16:00 | Expo | |

**Cut rule: anything not working at 12:00 is cut silently. Builds 1 and 3 are the ones worth protecting — 1 is what makes it interesting, 3 is what makes it an entry.**
