import type { LeadLineStatus } from "./types";

type Rec = Record<string, unknown>;

function asText(v: unknown) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function looksLikeLeadLine(row?: Rec | null) {
  if (!row) return false;
  const blob = `${asText(row.public_status)} ${asText(row.private_status)}`.toUpperCase();
  if (!blob.includes("LEAD")) return false;
  if (/\bNON[- ]?LEAD\b/.test(blob) && !/\bLEAD\b/.test(blob.replace(/NON[- ]?LEAD/g, ""))) return false;
  return true;
}

const PWSA_ZIPS = new Set([
  "15201",
  "15203",
  "15206",
  "15208",
  "15210",
  "15211",
  "15213",
  "15217",
  "15219",
  "15222",
  "15224",
  "15232",
  "15233",
]);

function waterUtility(zip?: string): Pick<LeadLineStatus, "utility" | "utilityLabel" | "mapUrl" | "filterUrl" | "filterLabel"> {
  if (zip && PWSA_ZIPS.has(zip)) {
    return {
      utility: "pwsa",
      utilityLabel: "Pittsburgh Water and Sewer Authority (PWSA)",
      mapUrl: "https://www.pgh2o.com/leadmap",
      filterUrl: "https://womenforahealthyenvironment.org/our-work/healthy-homes/healthy-homes-support-and-resources/",
      filterLabel: "Claim a free NSF-certified lead water filter (WHE / PWSA)",
    };
  }
  if (zip?.startsWith("151")) {
    return {
      utility: "pennsylvania_american",
      utilityLabel: "Pennsylvania American Water (McKeesport / Mon Valley)",
      mapUrl: "https://www.amwater.com/paaw/water-quality/lead-and-drinking-water/service-line-material-inventory-project",
      filterUrl: "https://info.nsf.org/Certified/DWTU/",
      filterLabel: "Find an NSF/ANSI 53 certified lead-reduction filter",
    };
  }
  return {
    utility: "unknown",
    utilityLabel: "Local water authority",
    mapUrl: "https://www.pgh2o.com/leadmap",
    filterUrl: "https://info.nsf.org/Certified/DWTU/",
    filterLabel: "Find an NSF/ANSI 53 certified lead-reduction filter",
  };
}

export function buildLeadLine(row: Rec | undefined, zip?: string): LeadLineStatus {
  const util = waterUtility(zip);
  const publicStatus = asText(row?.public_status) || undefined;
  const privateStatus = asText(row?.private_status) || undefined;
  const matched = Boolean(publicStatus || privateStatus);
  const isLead = looksLikeLeadLine(row);
  const pub = publicStatus ?? "not on file";
  const priv = privateStatus ?? "not on file";
  let summary: string;
  if (matched && isLead) {
    summary = `${util.utilityLabel} records flag a lead service line. Public (main → curb): ${pub}. Private (curb → house): ${priv}.`;
  } else if (matched) {
    summary = `${util.utilityLabel} inventory — public: ${pub}, private: ${priv}.`;
  } else if (util.utility === "pennsylvania_american") {
    summary =
      "This ZIP is outside the PWSA inventory (typical for McKeesport). Check Pennsylvania American Water’s service-line map for the main connection material.";
  } else {
    summary =
      "No parcel-level water service-line row matched yet. Treat the connection as unknown until the utility map confirms it.";
  }
  return {
    ...util,
    publicStatus,
    privateStatus,
    isLead,
    matched,
    summary,
  };
}
