# SCAN — Evidence Pack
**Everything cited, with sources. Compiled 05:05 Sat.**

Each item is marked **[CITED]** — a figure from the linked source — or **[OURS]** — our own reasoning, which you should never present as a finding. Don't blur the two in front of a judge; being precise about which is which is itself credibility.

---

## 1. Health impact

**[CITED] 21% of current asthma in the US is attributable to dampness and mould** — range 12–29%, roughly **4.6 million people** (2004 basis).
Mudarri & Fisk, *Public health and economic impact of dampness and mold*, **Indoor Air** 17(3), 2007. PMID 17542835.
Summary + updated cost figures: https://iaqscience.lbl.gov/health-related-costs-dampness-and-mold

**[CITED] Annual US health costs attributable to dampness and mould** (2014 estimates, Lawrence Berkeley National Laboratory):

| Condition | Annual cost | Range |
|---|---|---|
| Asthma morbidity | **$15.1B** | $9.4–20.6B |
| Allergic rhinitis | $3.7B | $2.3–4.7B |
| Acute bronchitis | $1.9B | $1.1–2.3B |
| Asthma mortality | $1.7B | $0.4–4.5B |

Same source as above.

**[CITED] WHO documented health outcomes** from indoor dampness and mould: respiratory symptoms, respiratory infections, asthma exacerbation, allergic rhinitis, hypersensitivity pneumonitis, allergic fungal sinusitis. Atopic and allergic individuals are most vulnerable.
*WHO Guidelines for Indoor Air Quality: Dampness and Mould*, WHO Europe, 2009.
https://www.ncbi.nlm.nih.gov/books/NBK143943/ · https://www.who.int/publications/i/item/9789289041683

---

## 2. Prevalence

**[CITED] Indoor dampness affects an estimated 10–50% of indoor environments** in Europe, North America, Australia, India and Japan — higher in river valleys and coastal regions.
WHO 2009, executive summary (link above).

---

## 3. Who actually bears it

**[CITED] 43% of renter households are worried about their home conditions.**
National Low Income Housing Coalition.
https://nlihc.org/resource/survey-finds-43-renter-households-are-worried-about-their-home-conditions

**[CITED] Renters are more likely than homeowners to face pests, heating problems, leaks and mould** — NLIHC analysis of the **American Housing Survey, 2019**. (The headline claim is in the title and source; pull the exact percentages off the infographic before quoting a number.)
https://nlihc.org/resource/renters-more-likely-homeowners-face-pests-heating-problems-leaks-and-mold

**[CITED] Damp- and mould-affected housing has documented mental health effects**, not only respiratory ones — state-of-the-science review.
https://pmc.ncbi.nlm.nih.gov/articles/PMC11334706/

**[OURS]** The person who can authorise a repair is the property owner; the person who suffers the exposure is the occupant. That asymmetry — not ignorance — is why damp goes unaddressed. This is our argument, not a cited finding.

---

## 4. Why nobody measures it

**[CITED] A professional mold inspection costs $303–$1,045, averaging $671.** Under 4,000 sq ft: $300–400. Laboratory testing is separate: $250–500 for air and surface sampling; swab tests $200–300; air tests $250–350.
Angi, 2026 cost data. https://www.angi.com/articles/mold-inspection-professionals-and-costs.htm

**[OURS]** That's the expert-gated measurement we're replacing with a phone — the same move medicly made against a motion-capture lab. A renter disputing a deposit or a guest arriving at a rental will not spend $671 to find out whether they should be worried.

---

## 5. Technical basis — CV for building defect detection

**[CITED] YOLOv5 + DenseNet blocks + Swin-Transformer heads, detecting building exterior defects.**
Dataset: **495 images** (206 web-sourced, 289 field-collected).
Results: **accuracy 84.42%, recall 77.83%, F1 0.81, mAP@0.5 82.56%, 55 FPS.**
Classes: cracks, exterior wall damage.
Chen, Y. & Li, D., *Disease detection on exterior surfaces of buildings using deep learning in China*, **Scientific Reports** 15, 8564 (2025). DOI 10.1038/s41598-025-92112-7
https://www.nature.com/articles/s41598-025-92112-7

**Why this one matters to us:** it establishes that **~500 images is enough to reach low-80s mAP** on building surface defects, and that it runs at real-time frame rates. That is the closest published benchmark to what we're doing and the right thing to compare ourselves against honestly.

**[CITED] Deep learning for detecting building defects using CNNs** — earlier work establishing the approach.
https://www.academia.edu/40089851/Deep_Learning_for_Detecting_Building_Defects_Using_Convolutional_Neural_Networks

**[CITED] UAV + deep learning for façade defect detection in residential buildings**, Sensors 25(23), 7118 (2025).
https://www.mdpi.com/1424-8220/25/23/7118

---

## 6. Datasets and models we can actually use

**Roboflow Universe — "Building defect on walls"**
472 images · classes `crack · mold · peeling_paint · stairstep_crack · water_seepage` · **CC BY 4.0** · free hosted inference at `serverless.roboflow.com` · no model trained on it yet.
https://universe.roboflow.com/builddef2/building-defect-on-walls

**Roboflow Universe — mold datasets and models**
https://universe.roboflow.com/search?q=class:mold
**Damp wall datasets**
https://universe.roboflow.com/search?q=class:damp+wall

**[OURS]** 472 images is in the same order as the 495 that produced 82.56% mAP in the Scientific Reports work. That's our honest expectation range — not a promise, a comparable.

---

## 7. Why progression, not single detection

**[CITED]** WHO's central recommendation is not a contamination threshold — it is that **dampness and mould problems be prevented, and remediated when they occur.** WHO explicitly declined to set quantitative thresholds. (WHO 2009, link above.)

**[OURS]** If there is no defensible threshold, then a single snapshot cannot say "this is bad." What *can* be established is **change over time** — the same surface, getting worse. That is why our measurement is `totalAffectedRatio` per surface across scans rather than a one-shot verdict, and it is the same structural move medicly made by tracking joint angles over a recovery rather than measuring once.

We have **no citation** that progression monitoring improves outcomes. Don't claim one.

---

## 8. Prior art — know it before a judge tells you

- Commercial AI mold-scanning products exist (e.g. moldscanner.ai and similar). Assume a judge may know one.
- Apple's **RoomPlan** and consumer apps (Polycam, magicplan) do phone-based room *scanning* — geometry, not defect detection. Different problem; worth being able to distinguish clearly if asked.
- **[OURS]** Our differentiators: progression over time, next-best-capture guidance, and an explicit review gate. Not the detection itself.

---

## 9. What we can and cannot claim

**Can say:**
- Surface-visible indicators of mould, water seepage, cracking and peeling paint.
- Triage: "this warrants a professional look."
- Change over time on the same surface.
- Confidence values, honestly reported, with our sample size stated.

**Cannot say — and a judge in this building may well know:**
- Anything about moisture *behind* a surface. Professional inspectors use moisture meters and infrared; a camera cannot see through drywall.
- Mould species or spore counts — that requires lab sampling ($250–500 per §4).
- A health diagnosis of any kind.
- That we detect infestations. Available pest datasets are agricultural insects, not building infestations. We dropped this.

**[OURS]** Saying these limits out loud, before being asked, is worth more than another feature. The team that names what its instrument can't do reads as the one that understands what it built.

---

## 10. Lines you can use verbatim

> "Twenty-one percent of current asthma in the US is attributable to dampness and mould — about 4.6 million people, and roughly fifteen billion dollars a year in asthma morbidity alone."

> "The WHO refused to set a threshold for how much mould is too much. So we don't measure a level — we measure change on the same surface over time."

> "A professional inspection is three hundred to a thousand dollars. Nobody disputing a security deposit is paying that."

> "The published benchmark closest to this reached eighty-three percent mAP on about five hundred images of building surface defects. We're training on a comparable set and we'll tell you our numbers, not our hopes."

---

## Full source list

1. Mudarri & Fisk, *Public health and economic impact of dampness and mold*, Indoor Air 17(3), 2007 — https://iaqscience.lbl.gov/health-related-costs-dampness-and-mold
2. WHO, *Guidelines for Indoor Air Quality: Dampness and Mould*, 2009 — https://www.ncbi.nlm.nih.gov/books/NBK143943/
3. Chen & Li, Scientific Reports 15:8564, 2025 — https://www.nature.com/articles/s41598-025-92112-7
4. Sensors 25(23):7118, 2025 (UAV façade defects) — https://www.mdpi.com/1424-8220/25/23/7118
5. NLIHC — renter home-condition worry — https://nlihc.org/resource/survey-finds-43-renter-households-are-worried-about-their-home-conditions
6. NLIHC / American Housing Survey 2019 — renters vs homeowners — https://nlihc.org/resource/renters-more-likely-homeowners-face-pests-heating-problems-leaks-and-mold
7. Damp/mould housing and mental health review — https://pmc.ncbi.nlm.nih.gov/articles/PMC11334706/
8. Angi mold inspection cost data, 2026 — https://www.angi.com/articles/mold-inspection-professionals-and-costs.htm
9. Roboflow Universe, Building defect on walls (CC BY 4.0) — https://universe.roboflow.com/builddef2/building-defect-on-walls
