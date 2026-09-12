# SCAN — Architecture
**Pivot locked ~04:35 Sat. Submission 16:00. ~11 hours.**

> **⚠️ Historical — superseded by `SCAN-MASTER-PLAN.md`.** This doc assumed Roboflow-primary detection (train a YOLO). What's actually built and verified working is **Gemini-primary** — the detector section below never got built and shouldn't now; don't lose time on it. Everything else here (the health/cost thesis, the progression argument, the "translator not engine" framing) still holds regardless of detector.

---

## 0. What it is

Point a phone at a wall. The model finds mold, water seepage and damage, records where and when, and **shows how it's changed since the last scan.**

The single measurement is a classifier. **The progression is the instrument.** That's the difference between a photo app and medicly, and it's the whole reason this wins or doesn't.

**Tracks: Travel + Optimization.** Travel is honest — you scan a place you're moving into, staying in, or handing back: a lease, a sublet, an Airbnb. Optimization has to be earned, see §3.

**The pain, cited:** ~**21% of current US asthma is attributable to dampness and mold** (≈4.6M people), with roughly **$15.1B/yr** in asthma morbidity costs alone, plus $3.7B allergic rhinitis and $1.9B acute bronchitis — Lawrence Berkeley National Lab. A professional inspection costs money most renters and guests won't spend, and the person who needs it least owns the property.

---

## 1. The loop

```
CAPTURE ──> DETECT ──> RECORD ──> COMPARE ──> REPORT
  guided      model      store     progression   gated
```

1. **Capture** — camera in the browser, guided room by room and surface by surface.
2. **Detect** — image to inference, back come boxes + class + confidence.
3. **Record** — image, detections, room, surface, timestamp. This is the measurement.
4. **Compare** — same room + same surface scanned again → affected area then vs now.
5. **Report** — a shareable record with location, severity and a timeline. **Nothing is a claim until a human reviews it** — that's the clinician gate, and it's what keeps a judge from asking whether you're diagnosing buildings.

---

## 2. Models

**Primary — Roboflow.** "Building defect on walls" on Roboflow Universe: 472 images, classes `crack · mold · peeling_paint · stairstep_crack · water_seepage`, CC BY 4.0, free hosted serverless inference at `serverless.roboflow.com`. No model trained on it yet — training a YOLO on it is 20–40 minutes. Merge in the standalone mold/damp-wall datasets on Universe to thicken it.

**Secondary — Gemini Vision.** Zero-shot second opinion, and the sponsor prize. Useful as a hedge if the trained model is shaky on a judge's random test image.

**Translator, not engine — the medicly move.** The CV does the sensing; the language model turns detections into a sentence a person can act on: *"Mold on the bathroom ceiling near the vent, about 0.3m², roughly 40% larger than your August scan."* Detection scores technical complexity, the model scores the sponsor prize. One architecture, two pools.

**Say surface-visible indicators and triage, never diagnosis.** A camera cannot see moisture behind drywall; real inspectors use meters and IR. Overclaiming is the fastest way to lose a judge who knows the domain.

---

## 3. Where the Optimization claim actually comes from

Don't declare Optimization on the strength of a classifier — judges will read the mismatch in your 50-word justification.

**Next-best-capture.** Mold isn't uniformly distributed. It concentrates on bathroom ceilings, under sinks, window frames, exterior-facing walls, behind furniture, around vents. So the app shouldn't let you wander — it should compute **which surface to photograph next** to maximise expected findings per capture, given what you've already covered and the priors on where defects occur.

```
value(surface) = prior_risk(surface_type)
               × (1 − coverage(surface))
               × recency_decay(last_scanned)
```

The user sees a coverage meter filling and a prompt: *"Now point at the window frame — highest remaining risk."* That's a real value-of-information ordering, it's visible on screen, and it's a defensible answer to "what's technically hard here."

It also makes the demo better: a judge holding your phone gets **told where to point**, instead of being handed a camera and left guessing.

---

## 4. Stack — keep what's already deployed

| Layer | Choice | Note |
|---|---|---|
| App | Next.js + TypeScript on Vercel | Already up. Don't touch it. |
| DB | MongoDB Atlas | Already up. New collections. |
| Images | Vercel Blob (or Cloudinary) | The one genuinely new piece of infra |
| Inference | Roboflow serverless, called **server-side** from a route | Keep the key off the client |
| Language | Gemini for the finding sentence | Optional path, never blocking |
| Voice | ElevenLabs for the demo video | 20 minutes, sponsor prize |

**Demo-path rule:** every inference result is cached against the image. If the network dies at the table, you replay stored results. A live model call must never be the only path to a working demo.

---

## 5. Data model

```ts
Property { _id, label, kind: "lease"|"sublet"|"stay", createdAt }

Scan {
  _id, propertyId, room, surface,        // "bathroom", "ceiling-vent"
  imageUrl, capturedAt,
  detections: [{ cls, confidence, bbox, areaPx, areaRatio }],
  totalAffectedRatio,                    // the number that trends
  finding                                // the model's sentence
}

Review { _id, scanId, reviewerRole, verdict: "confirmed"|"disputed", note, at }
```

`totalAffectedRatio` per (room, surface) over time **is the time series.** It's the joint angle. Everything in the report hangs off it.

---

## 6. Progression at a hackathon

You can't wait a week, and faking a trend is the one thing that will get you caught.

**Best option: real photos you already have.** If there are August photos of the Beacon St mold, that's a genuine two-point time series over five weeks — real, personal, and the strongest possible demo asset.

**Second: a controlled short interval.** Scan a surface now, alter something visible, scan again. Honest, small, and it proves the comparison pipeline works.

**Third: clearly labelled sample data** for the trend view, with a live scan running beside it. Label it on screen as sample. Never imply it's real.

---

## 7. Four bundles — still disjoint files

| Bundle | Owns | First deliverable |
|---|---|---|
| **Shell & contract** | `lib/types.ts`, `app/api/**`, blob storage, deploy | Types pushed + upload endpoint accepting an image, **inside 45 min** |
| **Capture client** | camera UI, guided surface prompts, coverage meter | A phone taking a photo and posting it |
| **Model** | Roboflow training, `/api/detect`, confidence calibration, Gemini finding | One real image returning real boxes |
| **Report & progression** | timeline view, before/after compare, severity, review gate | Two scans of one surface rendering a trend |

Same rules as before: types frozen once pushed, one person owns `package.json`, `git pull --rebase` before every push.

---

## 8. Gates

| Time | Gate |
|---|---|
| 05:30 | Types + image upload endpoint live. Roboflow training started. |
| 07:00 | **One real photo → real detections on screen.** If this isn't true by 07:00, the model path is in trouble and Gemini becomes primary. |
| 09:00 | Two scans of the same surface producing a comparison. |
| 11:00 | Coverage guidance working — the app tells you where to point. |
| 12:00 | **Feature freeze.** Record the demo video while it works. |
| 14:00 | Submit, two-hour buffer, track declared. |
| 16:00 | Expo. |

**Cut ruthlessly after 12:00.** A half-finished pivot at 14:00 is a zero; a small working instrument is not.
