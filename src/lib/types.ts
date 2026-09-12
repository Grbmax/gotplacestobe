export type DefectClass = "mold" | "water_seepage" | "crack" | "peeling_paint";

export type Detection = {
  cls: DefectClass;
  confidence: number;
  bbox: [number, number, number, number];
  areaRatio: number;
};

export type Property = {
  id: string;
  label: string;
  kind: "lease" | "sublet" | "stay";
  createdAt: string;
};

export type Scan = {
  id: string;
  propertyId: string;
  room: string;
  surface: string;
  imageUrl: string;
  capturedAt: string;
  detections: Detection[];
  totalAffectedRatio: number;
  finding: string;
  detector: "gemini" | "mock";
  review?: Review;
  isSample?: boolean;
};

export type Review = {
  verdict: "confirmed" | "disputed";
  reviewerRole: "tenant" | "owner" | "inspector";
  note?: string;
  at: string;
};

export type SurfaceCoverage = {
  room: string;
  surface: string;
  lastScannedAt: string | null;
  scanCount: number;
};
