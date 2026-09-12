import { photoIssues } from "./dashboard";
import type { CityContext, GrantMatch, Scan } from "./types";

export function grantMatch(context: CityContext | undefined, scans: Scan[]): GrantMatch {
  const photos = photoIssues(scans);
  const paint = Boolean(context?.leadPaintLikely || photos.counts.peeling_paint);
  const mold = photos.counts.mold > 0;
  const pre1978 = Boolean(context?.yearBuilt && context.yearBuilt < 1978) || Boolean(context?.leadPaintLikely);
  const highEbll = context?.areaLead?.level === "elevated" || context?.areaLead?.level === "watch";
  const eligible = pre1978 && (paint || mold || highEbll);

  if (!eligible) {
    return {
      eligible: false,
      title: "No automatic grant match yet",
      body: "Lead-Safe Homes and PWSA kits usually need a pre-1978 home plus a child under 6 or a pregnant household member. Confirm eligibility on the county site.",
      programs: [],
    };
  }

  const programs = [
    "Allegheny County Lead-Safe Homes Program (testing + repairs in qualifying pre-1978 homes)",
    "PWSA lead testing kit / service-line inquiry",
    "ACHD Housing & Community Environment inspection (Article VI)",
  ];
  return {
    eligible: true,
    title: "This property may qualify for free county lead testing and home repair assistance",
    body: [
      context?.yearBuilt ? `County records show built ${context.yearBuilt}.` : "Treated as pre-1978 housing stock.",
      paint ? "Peeling paint or lead-paint likelihood is on this report." : null,
      mold ? "Mold was flagged in a walkthrough photo." : null,
      highEbll ? "This ZIP/tract has elevated blood-lead rates among tested children." : null,
      "Programs typically also require a child under 6 or a pregnant household member and income screening.",
    ]
      .filter(Boolean)
      .join(" "),
    programs,
  };
}
