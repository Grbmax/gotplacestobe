import type { CityContext, Detection, Escalation, Scan } from "./types";

export const HIGH_LEAD_ZIPS = new Set(["15208", "15132", "15210"]);

export function escalateDetections(
  detections: Detection[],
  context?: CityContext,
): { detections: Detection[]; escalations: Escalation[]; findingExtra: string } {
  const zip = context?.zipCode ?? "";
  const highArea =
    context?.areaLead?.level === "elevated" ||
    context?.areaLead?.level === "watch" ||
    HIGH_LEAD_ZIPS.has(zip);
  const pre1978 = Boolean(context?.leadPaintLikely || (context?.yearBuilt && context.yearBuilt < 1978));
  const leadLine = Boolean(context?.leadServiceLine);
  const water = Boolean(context?.civic?.waterNearby);
  const escalations: Escalation[] = [];

  const next = detections.map((d) => {
    const copy: Detection = { ...d, priority: d.priority ?? "routine" };
    if (d.cls === "peeling_paint" && (pre1978 || highArea || leadLine)) {
      copy.priority = "high_lead_hazard";
      copy.civicLabel = "High lead hazard priority";
      escalations.push({
        cls: d.cls,
        from: "cosmetic paint failure",
        to: "high lead hazard priority",
        why: [
          pre1978
            ? context?.nearby?.used
              ? `nearby houses on this block typically pre-1978 (~${context?.yearBuilt ?? "year unknown"}; estimate)`
              : `pre-1978 structure (${context?.yearBuilt ?? "year unknown"})`
            : null,
          highArea ? `elevated blood-lead rates in ZIP ${zip || "this tract"}` : null,
          leadLine ? "PWSA lead service line flag" : null,
          "peeling paint in the frame",
        ]
          .filter(Boolean)
          .join(" + "),
      });
    } else if ((d.cls === "water_seepage" || d.cls === "mold") && water) {
      copy.priority = "moisture_priority";
      copy.civicLabel = "Moisture priority — nearby 311 water activity";
      escalations.push({
        cls: d.cls,
        from: d.cls.replace(/_/g, " "),
        to: "moisture / flooding priority",
        why: context?.civic?.prompt || "311 water or flood reports on this street",
      });
    }
    return copy;
  });

  const findingExtra = escalations
    .map((e) => `${e.from} elevated to ${e.to} because ${e.why}.`)
    .join(" ");

  return { detections: next, escalations, findingExtra };
}

export function applyCivicToScans(scans: Scan[], context?: CityContext): Scan[] {
  return scans.map((s) => {
    const e = escalateDetections(s.detections, context);
    return {
      ...s,
      detections: e.detections,
      escalations: e.escalations.length ? e.escalations : s.escalations,
      finding:
        e.findingExtra && !s.finding.includes(e.findingExtra)
          ? `${s.finding} ${e.findingExtra}`
          : s.finding,
    };
  });
}
