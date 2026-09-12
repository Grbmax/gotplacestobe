import { citationLines } from "@/lib/articleVi";
import { escalationSentence } from "@/lib/labels";
import type { CityContext, DefectClass, EbllLevel, Scan } from "@/lib/types";

export type Tone = "green" | "amber" | "rose" | "zinc";

export type IssueTile = {
  id: string;
  tone: Tone;
  kicker: string;
  title: string;
  body: string;
  read: string;
  notes?: string[];
};

const TONE_RANK: Record<Tone, number> = { green: 0, zinc: 1, amber: 2, rose: 3 };

export function louder(a: Tone, b: Tone): Tone {
  return TONE_RANK[a] >= TONE_RANK[b] ? a : b;
}

export function cityContextNeedsRefresh(ctx?: CityContext) {
  if (!ctx) return true;
  if (!ctx.areaLead || !ctx.civic || !ctx.leadLine) return true;
  if (!ctx.yearBuilt && !ctx.nearby?.used && !ctx.matched) return true;
  return false;
}

function ebllTone(level: EbllLevel | undefined): Tone {
  if (level === "elevated") return "rose";
  if (level === "watch") return "amber";
  if (level === "low") return "green";
  return "zinc";
}

export function photoIssues(scans: Scan[]) {
  const counts: Record<DefectClass, number> = {
    mold: 0,
    water_seepage: 0,
    crack: 0,
    peeling_paint: 0,
  };
  for (const scan of scans) {
    for (const d of scan.detections) counts[d.cls] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, photos: scans.length };
}

export function dashboardTiles(context: CityContext | undefined, scans: Scan[]): {
  overall: Tone;
  headline: string;
  tiles: IssueTile[];
} {
  const photos = photoIssues(scans);
  const tiles: IssueTile[] = [];

  const blockEstimate = Boolean(context?.nearby?.used);
  const year = context?.yearBuilt;

  if (context?.leadPaintLikely) {
    tiles.push({
      id: "paint",
      tone: "amber",
      kicker: blockEstimate && !context.parcelId ? "This block" : "This house",
      title: blockEstimate
        ? `Nearby houses built ~${year ?? "pre-1978"} · lead likely`
        : `Built ${year ?? "before 1978"} · lead likely`,
      body: context.leadPaintNote,
      read: blockEstimate
        ? "County assessment did not join this exact house number, so CribCheck uses nearby parcels on the same street. That is a block estimate, not a PIN-level year. Treat peeling paint as a possible lead-paint issue until a certified year shows up."
        : "HUD treats pre-1978 housing as likely to contain lead-based paint unless it has been certified otherwise. Peeling or chipped paint here is a health-housing issue, not cosmetic. Use wet-cleaning and licensed abatement if paint will be disturbed.",
      notes: [
        context.leadLine?.isLead
          ? context.leadLine.summary
          : context.leadServiceLine
            ? "Water-authority records flag a lead service line on this parcel."
            : "",
        context.parcelId ? `PIN ${context.parcelId}` : context.nearby?.note ?? "",
      ].filter(Boolean),
    });
  } else if (year && year >= 1978) {
    tiles.push({
      id: "paint",
      tone: "green",
      kicker: blockEstimate && !context?.parcelId ? "This block" : "This house",
      title: blockEstimate
        ? `Nearby houses built ~${year} · after the lead-paint ban`
        : `Built ${year} · after the lead-paint ban`,
      body: context?.leadPaintNote ?? "",
      read:
        "This assessment year is after the 1978 federal lead-paint ban, so peeling paint is less likely to be lead. Moisture and mold still matter. Confirm any remodel that reused older materials.",
      notes: [context?.parcelId ? `PIN ${context.parcelId}` : context?.nearby?.note ?? ""].filter(Boolean),
    });
  } else {
    tiles.push({
      id: "paint",
      tone: "zinc",
      kicker: "This house",
      title: "Year built not on file",
      body: context?.leadPaintNote ?? "County assessment did not match this address yet.",
      read:
        "County assessment did not join this address yet. Treat unknown-age rentals as possibly pre-1978 until a PIN and year built show up, especially if paint is failing.",
    });
  }

  const around = context?.areaLead;
  tiles.push({
    id: "around",
    tone: ebllTone(around?.level),
    kicker: "People around",
    title:
      around?.level === "elevated"
        ? "High blood-lead rates nearby"
        : around?.level === "watch"
          ? "Moderate blood-lead nearby"
          : around?.level === "low"
            ? "Lower blood-lead nearby"
            : "Blood-lead data thin",
    body: around?.summary ?? "PIN / ZIP has not been joined to ACHD blood-lead rates yet.",
    read:
      around?.level === "elevated" || around?.level === "watch"
        ? "This is a neighborhood health signal among children who were tested — not a blood test of this household or the people next door. Combined with peeling paint in an older house, CribCheck treats paint failure as a high lead-hazard priority."
        : "Published rates here are lower or too thin to publish. ACHD censors small counts. Still use lead-safe cleaning in older homes.",
    notes: [
      around?.zipCode && around.zipPercent != null
        ? `ZIP ${around.zipCode}: ${around.zipPercent.toFixed(1)}% of tested children (2021–24)`
        : "",
      around?.tractPercent != null
        ? `Census tract: ${around.tractPercent.toFixed(1)}% of tested children`
        : "",
      around?.zipNote,
      around?.tractNote,
    ].filter((n): n is string => Boolean(n)),
  });

  const nearbyFile =
    (context?.nearbyInspections?.length ?? 0) + (context?.nearbyServiceRequests?.length ?? 0);
  const fileCount =
    (context?.inspections.length ?? 0) +
    (context?.violations.length ?? 0) +
    (context?.serviceRequests.length ?? 0);
  const openish = (context?.violations ?? []).filter((v) => {
    const s = (v.status ?? "").toLowerCase();
    return s && !s.includes("correct") && !s.includes("closed") && s !== "c";
  });
  tiles.push({
    id: "file",
    tone: openish.length ? "rose" : fileCount ? "amber" : nearbyFile ? "amber" : "green",
    kicker: fileCount ? "Allegheny County record" : nearbyFile ? "This block" : "Allegheny County record",
    title: fileCount
      ? `${fileCount} ACHD housing record${fileCount === 1 ? "" : "s"}`
      : nearbyFile
        ? `No file on this PIN · ${nearbyFile} on this block`
        : "No ACHD housing inspections matched",
    body: openish.length
      ? `${openish.length} cited condition${openish.length === 1 ? "" : "s"} not marked corrected.`
      : fileCount
        ? "Complaints or inspections exist; read dates — they may already be closed."
        : nearbyFile
          ? "No Housing & Community Environment row for this house number. Nearby addresses on the same street do have a paper trail — shown as a block signal, not this PIN’s file."
          : "No Housing & Community Environment match for this PIN/address.",
    read: fileCount
      ? "These are Allegheny County Housing & Community Environment complaints and inspections for this address or PIN. Dates may already be closed. Use them to show the house has a municipal paper trail, not as a live court filing."
      : nearbyFile
        ? "These nearby ACHD rows are not citations against this exact house. They only show the block is in the county’s housing system. Do not paste them into a complaint as if they named this unit."
        : "No ACHD Housing & Community Environment row matched this street yet. That does not mean the unit is clear — only that this lookup found no file.",
    notes: [
      ...(context?.inspections ?? []).slice(0, 4).map((row) =>
        [row.type ?? "Inspection", row.date?.slice(0, 10)].filter(Boolean).join(" · "),
      ),
      ...(context?.nearbyInspections ?? []).slice(0, 3).map((row) =>
        ["Nearby", row.address, row.type ?? "inspection"].filter(Boolean).join(" · "),
      ),
      ...(context?.violations ?? []).slice(0, 4).map((row) =>
        [row.violation, row.status].filter(Boolean).join(" · "),
      ),
    ],
  });

  const leadHazard = scans.some((s) =>
    s.detections.some((d) => d.priority === "high_lead_hazard"),
  );
  if (photos.total > 0) {
    const bits = (Object.entries(photos.counts) as [DefectClass, number][])
      .filter(([, n]) => n > 0)
      .map(([cls, n]) => `${n} ${cls.replace(/_/g, " ")}`);
    tiles.push({
      id: "photos",
      tone: leadHazard || photos.counts.mold || photos.counts.water_seepage ? "rose" : "amber",
      kicker: "Your photos",
      title: leadHazard
        ? "Peeling paint elevated to high lead hazard"
        : `${photos.total} flag${photos.total === 1 ? "" : "s"} across ${photos.photos} photo${photos.photos === 1 ? "" : "s"}`,
      body: leadHazard
        ? `${bits.join(" · ")}. Cross-checked with year built, ZIP blood-lead rates, and PWSA line status.`
        : bits.join(" · "),
      read: leadHazard
        ? "Peeling paint in this walkthrough was elevated from cosmetic failure to high lead-hazard priority because of year built, neighborhood blood-lead rates, or a PWSA lead-line flag. Confirm the photo, then document repairs with the landlord."
        : "These flags come from Gemini (or the mock detector). Confirm or dispute each photo before treating it as a claim. Moisture plus nearby 311 water reports raises seepage and mold to a flooding priority.",
      notes: [
        ...scans.flatMap((s) => citationLines(s.detections)).slice(0, 6),
        ...scans
          .flatMap((s) => s.escalations ?? [])
          .slice(0, 3)
          .map((e) => escalationSentence(e)),
      ],
    });
  } else {
    tiles.push({
      id: "photos",
      tone: "zinc",
      kicker: "Your photos",
      title: "No walkthrough photos yet",
      body: "Walk rooms and snap surfaces. The model looks for mold, seepage, cracks, and peeling paint.",
      read: "Point the camera at bathrooms, under-sink plumbing, window frames, and basement walls. Each photo is stored on this house’s report. Same street address stays one report; a different apt/unit is a separate house.",
    });
  }

  const overall = tiles.reduce((acc, t) => louder(acc, t.tone), "green" as Tone);
  const headline =
    overall === "rose"
      ? "Conditions need attention"
      : overall === "amber"
        ? "A few things to check"
        : overall === "green"
          ? "County file looks quiet"
          : "Still gathering signals";

  return { overall, headline, tiles };
}
