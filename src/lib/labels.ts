import type { CityContext, Escalation, Property, Review } from "./types";

export const PROPERTY_KINDS: { value: Property["kind"]; label: string }[] = [
  { value: "lease", label: "Lease" },
  { value: "sublet", label: "Sublet" },
  { value: "stay", label: "Stay" },
];

export const REVIEW_ROLES: { value: Review["reviewerRole"]; label: string }[] = [
  { value: "tenant", label: "Renter" },
  { value: "owner", label: "Landlord" },
  { value: "inspector", label: "Inspector" },
];

export function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function kindLabel(kind: Property["kind"] | string) {
  return PROPERTY_KINDS.find((item) => item.value === kind)?.label ?? humanizeKey(kind);
}

export function roomLabel(room: string) {
  if (room === "any") return "Any room";
  return humanizeKey(room);
}

export function surfaceLabel(surface: string) {
  return humanizeKey(surface);
}

export function roomSurfaceLabel(room: string, surface: string, sep = " · ") {
  return `${roomLabel(room)}${sep}${surfaceLabel(surface)}`;
}

export function roleLabel(role: Review["reviewerRole"] | string) {
  return REVIEW_ROLES.find((item) => item.value === role)?.label ?? humanizeKey(role);
}

export function trendLabel(direction: "worsening" | "improving" | "stable" | "insufficient_data") {
  switch (direction) {
    case "worsening":
      return "Getting worse";
    case "improving":
      return "Improving";
    case "stable":
      return "Stable";
    case "insufficient_data":
      return "Need another scan";
  }
}

export function flaggedPercent(ratio: number) {
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.1) return "<0.1";
  return pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
}

export function lastFrameFlaggedCopy(ratio: number | null) {
  if (ratio == null) return "Not scanned yet";
  return `${flaggedPercent(ratio)}% of last frame flagged`;
}

export function thisFrameFlaggedCopy(ratio: number) {
  return `${flaggedPercent(ratio)}% of this frame flagged`;
}

export function deltaCopy(deltaRatio: number) {
  const pts = Math.abs(deltaRatio * 100);
  const pretty = pts >= 10 ? pts.toFixed(0) : pts.toFixed(1);
  if (Math.abs(deltaRatio) < 0.01) return "Affected area is unchanged";
  if (deltaRatio > 0) return `Affected area grew ${pretty} points`;
  return `Affected area shrank ${pretty} points`;
}

export type Severity = "clean" | "watch" | "elevated";

export function severityFromRatio(ratio: number | null, worsening = false): Severity {
  if (ratio == null) return "clean";
  if (worsening || ratio >= 0.08) return "elevated";
  if (ratio >= 0.03) return "watch";
  return "clean";
}

export function severityTextClass(severity: Severity) {
  switch (severity) {
    case "elevated":
      return "text-rose-600";
    case "watch":
      return "text-amber-700";
    case "clean":
      return "text-emerald-700";
  }
}

export function verdictLabel(verdict: Review["verdict"]) {
  return verdict === "confirmed" ? "Confirmed" : "Disputed";
}

const PRIORITY_PHRASE: Record<string, string> = {
  moisture_priority: "a moisture / flooding priority",
  high_lead_hazard: "a high lead-hazard priority",
  "moisture / flooding priority": "a moisture / flooding priority",
  "high lead hazard priority": "a high lead-hazard priority",
};

export function escalationSentence(escalation: Escalation) {
  const raw = escalation.to.trim();
  const treatedAs = PRIORITY_PHRASE[raw] ?? (raw.includes(" ") ? raw : humanizeKey(raw).toLowerCase());
  const why = escalation.why?.trim();
  if (why) return `Treated as ${treatedAs} because ${why}.`;
  return `Treated as ${treatedAs}.`;
}

export function civicCompactLine(context?: CityContext) {
  if (!context) return "County records not pulled yet";
  const bits: string[] = [];
  if (context.leadPaintLikely) bits.push(context.nearby?.used ? "Lead-paint era nearby" : "Lead-paint era");
  if (context.civic?.waterNearby) bits.push("water nearby");
  if (context.areaLead?.level === "elevated") bits.push("high lead nearby");
  else if (context.areaLead?.level === "watch") bits.push("watch lead nearby");
  if (!bits.length) {
    return context.ok && context.matched
      ? "County file looks quiet"
      : context.nearby?.used
        ? "Block estimate from nearby houses"
        : "Gathering county records";
  }
  return bits.join(" · ");
}
