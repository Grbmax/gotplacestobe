import { photoIssues } from "./dashboard";
import { HIGH_LEAD_ZIPS } from "./escalate";
import type { CityContext, GrantMatch, Scan } from "./types";

export const LEAD_SAFE_APPLY_URL =
  "https://actionhousing.org/our-services/allegheny-lead-safe-homes/";

export function grantMatch(context: CityContext | undefined, scans: Scan[]): GrantMatch {
  const photos = photoIssues(scans);
  const paint = Boolean(context?.leadPaintLikely || photos.counts.peeling_paint);
  const mold = photos.counts.mold > 0;
  const year = context?.yearBuilt ?? null;
  const pre1978 = Boolean(year && year < 1978) || Boolean(context?.leadPaintLikely);
  const zip = context?.zipCode ?? "";
  const highZip = HIGH_LEAD_ZIPS.has(zip) || context?.areaLead?.level === "elevated";
  const highEbll = context?.areaLead?.level === "elevated" || context?.areaLead?.level === "watch";
  const inCounty = Boolean(zip.startsWith("15"));
  const eligible = pre1978 && (paint || mold || highEbll || highZip);

  const checks = [
    {
      id: "age",
      label: "Built before 1978?",
      met: pre1978,
      detail: year ? `Yes (${year})` : context?.leadPaintLikely ? "Yes (treated as pre-1978)" : "Not on file yet",
    },
    {
      id: "zip",
      label: "High-risk ZIP?",
      met: highZip || highEbll,
      detail: zip
        ? highZip || highEbll
          ? `Yes (${zip}${highEbll && context?.areaLead?.level === "elevated" ? " · elevated blood-lead rates" : ""})`
          : `No published high-risk flag for ${zip}`
        : "ZIP not joined yet",
    },
    {
      id: "county",
      label: "Allegheny County address?",
      met: inCounty,
      detail: inCounty ? "Yes — ACTION-Housing intake covers this county." : "Need an Allegheny County street.",
    },
    {
      id: "hazard",
      label: "Paint / moisture hazard in photos?",
      met: photos.counts.peeling_paint > 0 || mold,
      detail:
        photos.counts.peeling_paint || mold
          ? "Yes — peeling paint or mold flagged on this report."
          : photos.photos
            ? "Walkthrough photos on file; no paint/mold flag yet."
            : "No walkthrough photos yet.",
    },
    {
      id: "household",
      label: "Child under 6 or pregnant household member?",
      met: "unknown" as const,
      detail: "Confirm with ACTION-Housing — required for most awards.",
    },
  ];

  return {
    eligible,
    amount: "up to $12,000",
    applyUrl: LEAD_SAFE_APPLY_URL,
    applyLabel: "Apply via ACTION-Housing",
    title: eligible
      ? "May qualify for up to $12,000 in free lead-safe repairs"
      : "No automatic Lead Safe Homes match yet",
    body: eligible
      ? "Eligible for up to $12,000 in free repairs (window replacements, repainting) via ACTION-Housing’s Allegheny Lead Safe Homes Program. Income screening still applies."
      : "Lead Safe Homes usually needs a pre-1978 home plus a child under 6 or a pregnant household member. Confirm eligibility on the county / ACTION-Housing site.",
    programs: [
      "Allegheny County Lead Safe Homes Program (testing + repairs in qualifying pre-1978 homes)",
      "PWSA / local utility lead testing kit / service-line inquiry",
      "ACHD Housing & Community Environment inspection (Article VI)",
    ],
    checks,
  };
}
