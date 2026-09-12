# SCAN — Four Parallel Tasks
**~04:50 Sat. Submission 16:00. Nobody waits for anybody.**

> **⚠️ Historical — superseded by `SCAN-MASTER-PLAN.md`.** Bundle C here assumed training a Roboflow model; the app runs on Gemini-primary detection instead, confirmed working live. The bundle-split discipline (own your files, `lib/types.ts` frozen, one person touches `package.json`) is still good practice, just apply it against what's actually in the repo now.

---

## The four contracts — freeze these by 05:15

Everything below works because these four things are agreed first and then not touched. Each is owned by one person; everyone else codes against the shape.

```ts
// A owns
type Detection = {
  cls: "mold" | "water_seepage" | "crack" | "peeling_paint";
  confidence: number;              // 0–1
  bbox: [x: number, y: number, w: number, h: number];  // normalised 0–1
  areaRatio: number;               // share of frame
};

// C owns — B calls this, never reads inside it
detect(frame: ImageData | HTMLVideoElement): Promise<Detection[]>

// D owns — B calls this, never reads inside it
nextBestSurface(covered: SurfaceCoverage[]): { surface: string; reason: string }

// A owns — B and D call these
POST /api/scans   { propertyId, room, surface, image, detections } -> { scan }
GET  /api/scans   ?propertyId=&room=&surface=                      -> { scans }
```

**Every person starts by faking the other three.** B writes a `detect()` that returns two random boxes. D renders from two hardcoded scans. Nobody is blocked at any point.

---

## A — Shell, contract, storage, deploy

**Files:** `lib/types.ts` · `app/api/**/route.ts` · `lib/blob.ts` · Vercel env

- Types for Property, Scan, Detection, Review.
- Image upload to Vercel Blob, returns a URL.
- Scan create + list + fetch-by-surface.
- Review endpoint (confirm / dispute).
- Keeps the Roboflow key server-side.
- Owns deploy. Also owns saying no to scope after 12:00.

**05:30 gate:** types pushed, and an endpoint that accepts an image from a phone and gives back a URL.

---

## B — Live camera client

**Files:** `app/scan/page.tsx` · `components/Viewfinder.tsx` · `components/Overlay.tsx` · `lib/camera.ts`

- `getUserMedia({ video: { facingMode: 'environment' } })`, video element with **`playsinline`** or iOS hijacks fullscreen.
- Canvas overlay above the video; draw boxes scaled from normalised coords.
- Downscale frames to ~320–416px before calling `detect()`.
- **Skip frames while inference is in flight** — never queue, or you drift seconds behind.
- Shutter button: freeze frame, POST the scan, show it saved.
- Renders D's prompt: *"Point at the window frame — highest remaining risk."*

**Build the entire overlay against fake detections.** This is completely independent of the model until 09:00.

**06:30 gate:** phone shows live camera with a hardcoded box drawn correctly on the video.

---

## C — Model

**Files:** `lib/detect-client.ts` · `app/api/detect/route.ts` · `lib/finding.ts` · training notebook

- Roboflow: pull "Building defect on walls" (472 imgs, `crack · mold · peeling_paint · stairstep_crack · water_seepage`), merge in the mold/damp-wall sets, train a YOLO. 20–40 min.
- **Two inference paths, in this order:** server route first (works today), then in-browser via `inferencejs` or ONNX Runtime Web.
- Confidence thresholds and class filtering — cut the classes that embarrass you.
- Gemini call turning detections into one plain sentence (`lib/finding.ts`). Never blocking.

**07:00 gate — hardest gate of the morning:** one real photo returning real boxes. **If that isn't true at 07:00, Gemini Vision becomes the primary detector** and the trained model becomes a stretch goal. Make that call on time, not at 11:00.

**11:00 stretch:** on-device inference working. This is what takes the network out of the demo path.

---

## D — Progression, report, and the optimization layer

**Files:** `lib/progression.ts` · `lib/nextbest.ts` · `app/report/page.tsx` · `components/Compare.tsx`

- `totalAffectedRatio` per (room, surface) — **this is the joint angle.** Everything trends off it.
- Before/after compare view: two images, two numbers, the delta.
- Timeline per surface.
- Severity from area + class + confidence.
- Review gate UI — confirmed / disputed, so nothing is a claim until a human says so.
- **`nextBestSurface()`** — `prior_risk(surface_type) × (1 − coverage) × recency_decay`. Hand-write the priors: bathroom ceilings, under sinks, window frames, exterior walls, around vents. **This is the entire Optimization track claim.**

**08:00 gate:** two hardcoded scans rendering a real trend view.

---

## Gates for everyone

| Time | What must be true |
|---|---|
| 05:15 | Four contracts frozen. Everyone building against fakes. |
| 05:30 | Types + image upload live. Training started. |
| 06:30 | Live camera with boxes drawn (fake detections fine). |
| 07:00 | **Real photo → real boxes.** Or Gemini becomes primary. |
| 08:00 | Trend view rendering. |
| 09:00 | Real detections wired into the live overlay. |
| 11:00 | Coverage guidance live. On-device inference if it's going to happen. |
| 12:00 | **Feature freeze. Record the video while it works.** |
| 14:00 | Submit. Two-hour buffer. |
| 16:00 | Expo. |

---

## Rules

- `lib/types.ts` frozen once pushed; changes go through A, announced aloud.
- One person touches `package.json`.
- `git pull --rebase` before every push.
- Nobody reads inside another bundle's module — call the function, trust the shape.
- **Whoever owns the demo is decided at 09:00**, and it's whoever is furthest ahead, not whoever wants it.
- Anything not working at 12:00 is cut. A half-finished pivot at 14:00 is a zero.
