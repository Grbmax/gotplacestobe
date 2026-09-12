"use client";

import { PhotoEvidence } from "@/components/PhotoEvidence";
import { ARTICLE_VI_URL, citationLines } from "@/lib/articleVi";
import { grantMatch } from "@/lib/grants";
import type { Property, Review, Scan } from "@/lib/types";

export function EvidencePrint({
  property,
  scans,
  role,
}: {
  property: Property;
  scans: Scan[];
  role: Review["reviewerRole"];
}) {
  const ctx = property.cityContext;
  const grant = grantMatch(ctx, scans);
  const exportedAt = new Date().toISOString();
  const cites = [...new Set(scans.flatMap((s) => citationLines(s.detections)))];

  return (
    <div id="legal-evidence" className="print-root hidden print:block">
      <header className="border-b border-zinc-300 pb-3">
        <p className="flex items-center gap-2 text-[10px] font-medium tracking-tight text-zinc-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-house-on-emerald.png" alt="" className="h-4 w-4 rounded-sm" />
          cribCheck · Legal evidence packet
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{property.label}</h1>
        <p className="mt-1 text-xs text-zinc-600">
          Exported {new Date(exportedAt).toLocaleString()} · {property.kind} · {scans.length} photo
          {scans.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">County facts</h2>
        <ul className="mt-1 list-disc pl-4 text-xs text-zinc-700">
          <li>Year built: {ctx?.yearBuilt ?? "not on file"}</li>
          <li>ZIP: {ctx?.zipCode ?? "not on file"} · PIN {ctx?.parcelId ?? "not on file"}</li>
          <li>{ctx?.leadPaintNote}</li>
          {ctx?.leadLine && <li>{ctx.leadLine.summary}</li>}
          {ctx?.areaLead && <li>{ctx.areaLead.summary}</li>}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">ACHD Article VI citations (visual findings)</h2>
        {cites.length ? (
          <ul className="mt-1 list-disc pl-4 text-xs text-zinc-700">
            {cites.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-zinc-600">No defect detections on file.</p>
        )}
        <p className="mt-1 text-[10px] text-zinc-500">
          Source: Allegheny County Health Department Rules & Regulations, Article VI.{" "}
          {ARTICLE_VI_URL}
        </p>
      </section>

      {grant.eligible && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-zinc-900">Lead Safe Homes checklist</h2>
          <ul className="mt-1 list-disc pl-4 text-xs text-zinc-700">
            {grant.checks.map((c) => (
              <li key={c.id}>
                {c.label} {c.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">Timestamped photos with bounding boxes</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {scans.map((scan) => (
            <PhotoEvidence key={scan.id} scan={scan} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded border border-zinc-400 p-3">
        <h2 className="text-sm font-semibold text-zinc-900">Inspector signature block</h2>
        <p className="mt-2 text-xs text-zinc-700">
          I certify that these photographs and overlays were captured in cribCheck and have not been
          altered except for on-image bounding boxes generated from the detector output.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6 text-xs text-zinc-800">
          <p>
            Role: {role}
            <span className="mt-6 block border-b border-zinc-800 pt-6">Signature</span>
          </p>
          <p>
            Date: {new Date().toLocaleDateString()}
            <span className="mt-6 block border-b border-zinc-800 pt-6">Printed name</span>
          </p>
        </div>
      </section>

      <p className="mt-6 text-[10px] leading-relaxed text-zinc-500">
        Disclaimer: Blood-lead rates are among children who were tested in this ZIP/tract, not a
        diagnosis of this household. ACHD censors small counts. Visual detections are not a
        certified lead inspection. Water-line material comes from public PWSA / WPRDC inventory
        when a parcel matches; McKeesport and other utilities may require a separate lookup. This
        packet is documentation for a complaint or repair demand, not legal advice.
      </p>
    </div>
  );
}
