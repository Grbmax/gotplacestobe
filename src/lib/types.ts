export type DefectClass = "mold" | "water_seepage" | "crack" | "peeling_paint";

export type Role = "tenant" | "owner" | "inspector";

export type Identity = {
  id: string;
  name: string;
  role: Role;
};

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
  createdBy?: string;
  createdByName?: string;
  isSample?: boolean;
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
  scannedBy?: string;
  scannedByName?: string;
};

export type Review = {
  verdict: "confirmed" | "disputed";
  reviewerRole: Role;
  reviewerId?: string;
  reviewerName?: string;
  note?: string;
  at: string;
};

export type SurfaceCoverage = {
  room: string;
  surface: string;
  lastScannedAt: string | null;
  scanCount: number;
};
