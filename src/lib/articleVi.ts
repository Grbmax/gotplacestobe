import type { DefectClass, Detection } from "./types";

export type ArticleViCite = {
  section: string;
  title: string;
  hazard: string;
};

/** ACHD Rules & Regulations Article VI (Housing and Community Environment), current numbering. */
export const ARTICLE_VI_URL =
  "https://www.alleghenycounty.us/files/assets/county/v/4/government/health/documents/housing-and-community/article-6-hac.pdf";

const BY_CLASS: Record<DefectClass, ArticleViCite[]> = {
  peeling_paint: [
    {
      section: "651.B.4",
      title: "Lead Hazards",
      hazard: "Deteriorated Paint Hazard",
    },
    {
      section: "622",
      title: "Principal Components",
      hazard: "Surface Maintenance",
    },
  ],
  water_seepage: [
    {
      section: "622",
      title: "Principal Components",
      hazard: "Weathertight & Watertight",
    },
    {
      section: "645.A.1",
      title: "Occupancy of Basements and Cellars",
      hazard: "Dampness & Water Ingress",
    },
    {
      section: "626",
      title: "Grading and Drainage",
      hazard: "Standing Water / Ingress",
    },
  ],
  mold: [
    {
      section: "645.A.1",
      title: "Occupancy of Basements and Cellars",
      hazard: "Dampness / Mold Condition",
    },
    {
      section: "650",
      title: "Ventilation",
      hazard: "Inadequate Ventilation",
    },
  ],
  crack: [
    {
      section: "622",
      title: "Principal Components",
      hazard: "Sound and Tight / Structural Repair",
    },
  ],
};

export function citesFor(cls: DefectClass): ArticleViCite[] {
  return BY_CLASS[cls] ?? [];
}

export function citeLine(cite: ArticleViCite) {
  return `Section ${cite.section} — ${cite.title} (${cite.hazard})`;
}

export function primaryCite(cls: DefectClass): ArticleViCite {
  return citesFor(cls)[0] ?? {
    section: "622",
    title: "Principal Components",
    hazard: "Good Repair",
  };
}

export function citationLines(detections: Detection[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of detections) {
    for (const c of citesFor(d.cls)) {
      const line = citeLine(c);
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}
