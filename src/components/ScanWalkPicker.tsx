"use client";

import { formatScanTime } from "@/lib/time";
import { suggestedWalkKind, walkKindLabel, walksChronological, WALK_KINDS } from "@/lib/walks";
import type { Property, Walk, WalkKind } from "@/lib/types";

export function ScanWalkPicker({
  house,
  lastWalkId,
  busy,
  onContinue,
  onCreate,
}: {
  house: Property;
  lastWalkId: string | null;
  busy?: boolean;
  onContinue: (walk: Walk) => void;
  onCreate: (kind: WalkKind) => void;
}) {
  const walks = walksChronological(house.walks ?? []);
  const nextKind = suggestedWalkKind(walks);
  const extraKinds = WALK_KINDS.filter((item) => item.value !== nextKind);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <p className="text-[11px] font-medium tracking-[0.12em] text-emerald-700">Scan</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Which record?</h1>
      <p className="mt-2 text-sm text-slate-500">
        {house.label} stays one house. Each walk is a dated packet — move-in, a check during the lease, or
        exit — so the PDF can compile the tenure without splitting the address.
      </p>

      <div className="mt-5 space-y-2">
        {walks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No walks yet. Start with a move-in record.
          </p>
        ) : (
          walks.map((walk) => {
            const last = walk.id === lastWalkId;
            return (
              <button
                key={walk.id}
                type="button"
                disabled={busy}
                onClick={() => onContinue(walk)}
                className={`w-full rounded-2xl border bg-white p-4 text-left ${
                  last ? "border-emerald-600" : "border-slate-200"
                }`}
              >
                {last && (
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">Continue</p>
                )}
                <p className={`text-lg font-medium ${last ? "mt-0.5" : ""}`}>{walkKindLabel(walk.kind)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Started {formatScanTime(walk.startedAt)}
                  {walk.closedAt ? " · closed" : " · open"}
                </p>
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onCreate(nextKind)}
        className="mt-6 w-full rounded-full bg-emerald-600 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Opening…" : `Start ${walkKindLabel(nextKind).toLowerCase()} walk`}
      </button>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {extraKinds.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={busy}
            onClick={() => onCreate(item.value)}
            className="text-xs text-slate-500 underline underline-offset-4"
          >
            Start {item.label.toLowerCase()} instead
          </button>
        ))}
      </div>
    </main>
  );
}
