# SCAN — Punch List
**Compiled 05:35 Sat, from the actual codebase on the `scan` branch — not the planning docs. Submission 16:00, ~10.5h left.**

> **Status update ~10:00 Sat: items 1–8 below are fixed and verified** (real Gemini confirmed live with a corrected model name, sample-property mixing blocked server-side, images downscaled before encoding, `ensureSeed` caching + duplicate-key handling, coverage-decay fix, dead ternary removed). **#9 (N+1 fetch) and getting a real Vercel Blob token are still open** — low priority, not blocking. See `SCAN-MASTER-PLAN.md` for what's current.

---

## 0. Reconciliation — your planning docs disagree with what's built

`SCAN-ARCHITECTURE.md` / `SCAN-TASKS.md` describe **Roboflow-primary** (train a YOLO on "Building defect on walls," Gemini as secondary translator). What's actually built and typechecking cleanly right now is **Gemini-primary** (`src/lib/detect.ts` — real `GoogleGenAI` call with structured schema, falls back to mock on any failure). Roboflow was never touched.

**Recommendation: don't train a Roboflow model now.** It's redundant work for no clear upgrade — Gemini-primary is done, satisfies the sponsor track directly, and your own architecture doc already treats "Gemini becomes primary" as an acceptable outcome if Roboflow isn't ready by 07:00. You're already past that fork, just via the other branch of it.

**One real fix needed:** `SCAN-EVIDENCE.md`'s pitch lines ("we're training on a comparable set and we'll tell you our numbers") assume a self-trained model. Reword to describe zero-shot Gemini Vision detection instead — everything else in that doc (health stats, cost stats, the progression-not-single-detection philosophy) is detector-agnostic and still fully valid.

---

## 1. CRITICAL — fix before any demo

1. **`GEMINI_API_KEY` is not set.** Checked `.env.local` directly — it's absent. Right now, every single scan is running on mock. Zero real Gemini calls have happened. This is the whole sponsor-track claim and it's currently false. Get a free key at ai.google.dev / Google AI Studio, add to `.env.local` and Vercel env vars, then **do a real end-to-end test scan** to confirm the badge actually says "Gemini."
2. **Model name risk.** `detect.ts` hardcodes `model: "gemini-2.5-flash"`. If that's been renamed/deprecated, every call throws, gets caught, and silently falls back to mock — the only visible symptom is the badge staying on "Mock" forever, easy to miss under demo pressure. The moment the key is added, watch server logs for `[detect] Gemini failed, falling back to mock` on the first real scan.
3. **Sample data can get mixed into a real trend line.** `/scan` defaults `propertyId` to `properties[0]` (newest-created-first). If anyone opens `/scan` before creating a real property, their live scan attaches to the seeded sample property (`prop_sample_beacon`). `surfaceTrend()` and `CompareView` have **zero awareness of `isSample`** — they'd blend a real scan into the fake 5-week trend, producing a "worsening 200%!" claim built half on fabricated data. Per-card badges are correct, but the aggregate graph isn't defended. Fix one of: (a) block scans against sample properties server-side in `createScan`, (b) exclude `isSample` scans from `surfaceTrend`/coverage math whenever a real scan exists in the same group, (c) don't pre-select a default property on `/scan` at all.
4. **Full-resolution images are sitting inside MongoDB documents as base64 data URLs.** Confirmed — `BLOB_READ_WRITE_TOKEN` isn't set either, so `persistImage()` falls through to storing the raw data URL. Every `GET /api/scans` call (home page's per-property loop, `/scan`'s coverage check, the report page) drags multi-MB strings over the wire even when nothing needs to render an image. Combined with Atlas's baseline latency (measured 1-1.5s/round-trip on tonight's other app), this will make every page feel sluggish and gets worse as you test. Fix, in order of effort: (a) get a Vercel Blob token — code already prefers it, near-zero change; (b) downscale in `Viewfinder.shutter()` before encoding (cap ~1280px longest edge instead of full native camera resolution); (c) add a projection so list-only callers skip `imageUrl`.

## 2. Real bugs, lower severity

5. **`nextBestSurface`'s coverage math permanently zeroes a surface after 2 scans.** `coverageScore = min(scanCount/2, 1)` → once coverage hits 1, `value = prior × 0 × decay = 0` forever, no matter how much time passes. `reasonFor()` even generates "due for a recheck" as a possible string — that's dead code, a surface can never be recommended again past its 2nd scan. Low-impact for a demo, one-line fix if there's slack: `value = prior × (0.15 + 0.85×(1−coverage)) × decay` so recency can claw back some score.
6. **`ensureSeed()` runs a Mongo `countDocuments()` on every single store call** — not just once at startup (`listProperties`, `createProperty`, `listScans`, `getScan`, `createScan`, `reviewScan` all call it first). That's doubling the round-trip cost of every request against Atlas, forever. Cheap fix: cache a module-level "seeded" flag for the Mongo path too, same as the in-memory `mem.seeded` already does.
7. **`ensureSeed()`'s Mongo insert has no duplicate-key handling.** Sample records use fixed IDs. Two concurrent cold-start requests both seeing `count === 0` will race, and the second `insertOne` throws an uncaught `E11000` that 500s that request. Wrap in try/catch, swallow duplicate-key errors.
8. **Dead ternary** in `Viewfinder.tsx:170` — `analyzing ? "preview" : "preview"` always evaluates the same either way. Harmless, but reads like a bug to the next person. One-line simplify.
9. **N+1 fetch pattern** on the home page and `propertySummaries()` — one sequential `await` per property. Fine at hackathon scale, but compounds bug #4 since each fetch drags full images along too.

Build/lint status: `tsc --noEmit` is clean. `eslint` has 2 pre-existing "setState in effect" warnings (`page.tsx`, `report/[propertyId]/page.tsx`) — stylistic, not functional, not urgent.

## 3. From the mold repo + paper you shared (verified, not guessed)

- **`dtian09/Mould_Classification_Segmentation`**: ViT (classification) + U-Net (segmentation) pipeline on Roboflow's "YOLOv7 Mould Detection" set. **No accuracy numbers reported** — architecture documentation only. Useful part: a defensible **severity taxonomy** — Normal (0) / Small-Medium (0–0.15) / Large (0.15–0.3) / Extra Large (>0.3) by normalized area. Adopt this in the Gemini prompt and surface it as a severity chip next to the raw percentage — gives you a literature-grounded label instead of an arbitrary number.
- **Zhu, R. (2025), "Wall Defect Detection Based on Improved YOLOv8," AICI '25, ACM. DOI 10.1145/3730436.3730523.** Full text paywalled (403) — only the abstract is verified. Reports **mAP@0.5 = 73.9%, recall = 68.2%** for a purpose-built, loss-tuned YOLOv8 on general wall defects (not mold-specific). **Use this honestly**: "published state-of-the-art wall-defect detectors sit in the low-70s% — we're using Gemini Vision zero-shot and expect a comparable range, and we're saying that upfront rather than claiming near-100%." This is the exact move `SCAN-EVIDENCE.md` §9 already argues for — naming your limits before being asked.
- Nothing verified beyond these two headline numbers for the ACM paper — don't quote methodology or per-class confusion, that's behind the paywall.

## 4. ElevenLabs — corrected plan (in-app feature, not a video)

**Correction from research below: HackCMU judging is a live 3-minute pitch + 1-minute Q&A at your table, per the actual HackCMU 2025 Devpost rules (closest verified precedent — worth confirming against this year's page). No pre-recorded video is required or scored.** That changes what "Best Use of ElevenLabs" should actually be: not a narrated video, but a real in-app feature judges see live.

**Do this instead: ElevenLabs reads the finding sentence aloud, hands-free, right after a scan completes.** You're usually holding the phone up against a ceiling or behind furniture with your other hand occupied — hearing "Mold detected near the vent, moderate confidence" instead of reading tiny text is a genuine UX win, not decoration, and it's demoable in the exact 3-second window that makes technical complexity visible.

- Implementation: on scan result, call ElevenLabs' text-to-speech API with `resultScan.finding`, play the returned audio automatically (or behind a small speaker-icon button if autoplay policies are annoying on iOS Safari — same autoplay gotcha as the camera, needs a user gesture or a tap-to-hear fallback).
- Pick a calm, clear voice from ElevenLabs' library — clarity matters more than personality here, it's being heard in a loud expo hall.
- This is genuinely small: one new API route (`/api/speak` or inline), cache the audio per scan if you want to avoid re-calling on replay. Budget 20-30 minutes, same as originally estimated, just pointed at the product instead of a video.
- Keep this optional/gracefully degrading like every other integration — if the ElevenLabs call fails, the text finding is still right there on screen. Never let it block the scan flow.

**Original cinematic-video script below is still worth keeping** — as a bonus Devpost asset if you have spare time after the above, not as the sponsor-track claim itself. Don't spend more than the leftover budget on it.

### Bonus: cinematic demo video plan (optional, not scored)

**Target: 75-90 seconds. Narration does the emotional work; the screen recording does the technical-complexity work — don't make them compete.**

**Voice:** pick a calm, warm, credible narrator voice from ElevenLabs' library — documentary tone, not hype-ad tone. This is a story about renters and health, not a startup teaser; a voice that sounds like it's leveling with you will land harder than one that sounds like it's selling you something.

**Script** (feed straight into ElevenLabs' text-to-speech; lines marked [CITED] are pulled verbatim from `SCAN-EVIDENCE.md` §10 — already fact-checked, use them as-is):

> **[0:00–0:08] — cold open, over a close, slightly unsettling shot of a real water stain or mold patch, no music yet**
> "Twenty-one percent of current asthma in the US is attributable to dampness and mould. About four point six million people." *(beat)* "Nobody told them."

> **[0:08–0:20] — cut to a renter-POV shot, quiet**
> "A professional inspection costs three hundred to a thousand dollars. Nobody disputing a security deposit — or arriving at a sublet at midnight — is paying that."

> **[0:20–0:28] — title card / app name over black**
> "So we built the thing that's actually in your pocket."

> **[0:28–0:55] — live screen recording, phone in hand, THIS IS THE MAIN SHOT**
> "Point your phone at a wall. It tells you where to look first — this ceiling's never been scanned, and it's high risk." *(shutter sound, real UI, no narration for 2-3 seconds — let the "Analyzing…" state breathe)* "That's a real call to Gemini Vision, structured detection, back in about a second." *(finding sentence appears on screen)*

> **[0:55–1:10] — cut to the report page, the progression graph filling in — THE MONEY SHOT**
> "But one photo is just a photo. The real measurement is what changes." *(timeline animates, worsening badge appears)* "Same surface, five weeks apart. That's not a guess — that's the same wall, twice."

> **[1:10–1:20] — quick, confident technical beat, maybe a flash of the DetectorBadge / a JSON snippet**
> "Published state-of-the-art wall-defect detectors sit in the low seventies percent. We're not claiming more than that. We're claiming honesty and a timeline."

> **[1:20–1:30] — close on the app name / tagline, narration slows down**
> "SCAN. Nothing is a claim until a human confirms it. But now, at least, someone's looking."

**Production notes:**
- Record the actual screen capture FIRST (once the app is stable, per your own 12:00 feature-freeze gate), then time the ElevenLabs narration to it — don't generate narration to a fixed length and force footage to match, it'll feel padded.
- Real UI sounds (shutter click, the soft "ping" if you have one) under the narration gaps sell authenticity better than a music bed. If you want music at all, keep it a single quiet ambient pad that drops out entirely during the report-page reveal — let the graph and the narration have that moment alone.
- Don't over-produce. Per your own evidence pack's own instinct (§9: naming your limits is worth more than another feature) — the same applies to the video. A clean, confident, honest 80 seconds beats a slick 3-minute reel for this specific judging format (in-person expo, Devpost video is secondary).
- This is a ~20-30 minute task once the app is stable (per `SCAN-ARCHITECTURE.md`'s own estimate) — genuinely one of the cheapest, lowest-risk items left on this list. Don't start it before the 12:00 feature freeze.

## 5. HackCMU 2025 presentation research — completed

No public video exists for last year's winners (Devpost gallery for HackCMU 2025 was never published, and no YouTube/Loom links found for medicly or any other winner). But the actual judging format was confirmed directly from HackCMU 2025's Devpost rules page:

**Format: live 3-minute pitch + 1-minute Q&A, assigned table timeslot. No pre-recorded video required.** Judging criteria: Originality ("entirely novel, fresh approach"), Technical Difficulty ("real technical challenges vs. ChatGPT wrapper"), Demo Quality (explicitly capped "under 3 minutes"), Usefulness, plus track relevance. Confirm this year's exact rules page hasn't changed the format, but treat this as the strong default assumption.

**medicly** (2025 grand prize, github.com/scrappydevs/medicly) — smartphone video + pose estimation, clinician-gated, "20x workflow acceleration." No demo video found, but their pitch materials establish the pattern worth copying:

1. **Hard cap your live pitch at 3 minutes** — it's a scored criterion, not a suggestion.
2. **Open with a quantified stat in the first 10 seconds** — medicly used "14-day average PT eval wait, ~35% adherence." You have the equivalent: "21% of current US asthma is attributable to dampness and mold — 4.6 million people" (`SCAN-EVIDENCE.md` §10).
3. **Show numeric pipeline output live, don't narrate over a polished UI.** medicly showed pose landmarks and joint-angle numbers, not just a nice screen. Your equivalent: let the judge watch the bounding boxes draw, the confidence percentage, and the progression graph actually render — the visible math is the point, per judges explicitly penalizing "ChatGPT wrapper" demos.
4. **Hand the judge the phone.** A live demo where the judge points the camera themselves (guided by your next-best-capture prompt telling them where to point) reads as more credible than you holding it and narrating.
5. **Script the live pitch first, treat any video as secondary.** If you still want a video for the Devpost page, let it mirror the same beats as the live pitch rather than being a separate production.
