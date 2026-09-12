"use client";

import { BackLink } from "@/components/BackLink";
import { BrandLockup } from "@/components/BrandLockup";
import { formatScanTime } from "@/lib/time";
import { openWalk, walkKindLabel, walkPhase, walksChronological } from "@/lib/walks";
import type { Property, Walk, WalkKind } from "@/lib/types";

export function ScanWalkPicker({
  house,
  busy,
  onContinue,
  onCreate,
  onCloseAll,
  onCheckReport,
}: {
  house: Property;
  busy?: boolean;
  onContinue: (walk: Walk) => void;
  onCreate: (kind: WalkKind) => void;
  onCloseAll: () => void;
  onCheckReport: () => void;
}) {
  const walks = walksChronological(house.walks ?? []);
  const phase = walkPhase(walks);
  const current = openWalk(walks);

  const green =
    phase === "start_move_in"
      ? { label: "Start move-in walk", run: () => onCreate("move_in") }
      : phase === "continue_move_in" && current
        ? { label: "Continue move-in", run: () => onContinue(current) }
        : phase === "continue_mid" && current
          ? { label: "Continue mid-stay walk", run: () => onContinue(current) }
          : phase === "continue_exit" && current
            ? { label: "Continue exit walk", run: () => onContinue(current) }
            : { label: "Check house report", run: onCheckReport };

  const gray =
    phase === "continue_move_in"
      ? [
          { label: "Start mid-stay instead", run: () => onCreate("mid") },
          { label: "Start exit instead", run: () => onCreate("exit") },
        ]
      : phase === "continue_mid"
        ? [{ label: "Start exit instead", run: () => onCreate("exit") }]
        : phase === "continue_exit"
          ? [{ label: "Close all records", run: onCloseAll }]
          : [];

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8 text-slate-900">
      <BackLink href="/scan">Change house</BackLink>
      <div className="mt-4">
        <BrandLockup />
      </div>
      <p className="mt-3 text-[11px] font-medium tracking-[0.12em] text-emerald-700">Scan</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Which record?</h1>
      <p className="mt-2 text-sm text-slate-500">
        {house.label} stays one house. Start move-in, then mid-stay, then exit. Starting the next walk closes the
        one before it.
      </p>

      {walks.length > 0 && (
        <ul className="mt-5 space-y-2">
          {walks.map((walk) => (
            <li
              key={walk.id}
              className={`rounded-2xl border bg-white p-4 ${
                walk.id === current?.id ? "border-emerald-600" : "border-slate-200"
              }`}
            >
              <p className="text-lg font-medium">{walkKindLabel(walk.kind)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Started {formatScanTime(walk.startedAt)}
                {walk.closedAt ? " · closed" : " · open"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={green.run}
        className="mt-6 w-full rounded-full bg-emerald-600 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Opening…" : green.label}
      </button>
      {gray.length > 0 && (
        <div className="mt-3 space-y-2">
          {gray.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={busy}
              onClick={item.run}
              className="w-full rounded-full bg-slate-200 py-3.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
