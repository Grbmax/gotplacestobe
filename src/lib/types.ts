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
  priority?: "routine" | "watch" | "high_lead_hazard" | "moisture_priority";
  civicLabel?: string;
};

export type Escalation = {
  cls: DefectClass;
  from: string;
  to: string;
  why: string;
};

export type CivicPulse = {
  waterNearby: boolean;
  prompt?: string;
  recent: { type: string; street: string; at: string; neighborhood?: string }[];
  monthly: { month: string; count: number }[];
};

export type GrantCheck = {
  id: string;
  label: string;
  met: boolean | "unknown";
  detail: string;
};

export type GrantMatch = {
  eligible: boolean;
  title: string;
  body: string;
  programs: string[];
  amount: string;
  applyUrl: string;
  applyLabel: string;
  checks: GrantCheck[];
};

export type LeadLineStatus = {
  utility: "pwsa" | "pennsylvania_american" | "unknown";
  utilityLabel: string;
  publicStatus?: string;
  privateStatus?: string;
  isLead: boolean;
  matched: boolean;
  summary: string;
  mapUrl: string;
  filterUrl: string;
  filterLabel: string;
};

export type HousingInspection = {
  inspectionId: string;
  serviceRequest?: string;
  date?: string;
  type?: string;
  address: string;
  city?: string;
  requestType?: string;
};

export type HousingViolation = {
  inspectionId: string;
  serviceRequest?: string;
  violation: string;
  description?: string;
  status?: string;
  date?: string;
};

export type HousingServiceRequest = {
  number: string;
  date?: string;
  address: string;
  city?: string;
  requestType?: string;
  propertyType?: string;
};

export type EbllLevel = "low" | "watch" | "elevated" | "unknown";

export type AreaLead = {
  pin?: string;
  zipCode?: string;
  censusTract?: string;
  zipPercent?: number | null;
  zipNote?: string;
  tractPercent?: number | null;
  tractNote?: string;
  level: EbllLevel;
  summary: string;
};

export type CityContext = {
  fetchedAt: string;
  ok: boolean;
  matched: boolean;
  source: "wprdc";
  parcelId?: string;
  zipCode?: string;
  yearBuilt?: number | null;
  neighborhood?: string;
  leadPaintLikely: boolean;
  leadServiceLine?: boolean;
  leadLine?: LeadLineStatus;
  leadPaintNote: string;
  areaLead?: AreaLead;
  civic?: CivicPulse;
  serviceRequests: HousingServiceRequest[];
  inspections: HousingInspection[];
  violations: HousingViolation[];
  error?: string;
};

export type Property = {
  id: string;
  label: string;
  kind: "lease" | "sublet" | "stay";
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  isSample?: boolean;
  unit?: string;
  placeKey?: string;
  cityContext?: CityContext;
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
  escalations?: Escalation[];
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
  lastDetections?: Detection[];
};
