"use client";

import { CLAIM_MS } from "@/lib/data";
import { zoneById } from "@/lib/data";
import type { Quest } from "@/lib/types";

type Props = {
  quest: Quest | null;
  remainingMs: number;
  onClose: () => void;
  onBail: () => void;
  onDone: () => void;
};

export function ActiveTask({ quest, remainingMs, onClose, onBail, onDone }: Props) {
  if (!quest) {
    return (
      <div className="flex h-full flex-col bg-ink px-6 pt-8 text-paper">
        <p className="text-xs uppercase tracking-[0.2em] text-leaf">Active</p>
        <h1 className="serif mt-3 text-4xl">Nothing in your hands.</h1>
        <p className="mt-3 text-sm text-paper/55">
          Take a ping from the map. You’ll get five minutes before it goes back out to everyone else.
        </p>
        <button type="button" onClick={onClose} className="mt-8 rounded-full bg-leaf px-5 py-3 text-sm font-semibold text-ink">
          Back to map
        </button>
      </div>
    );
  }

  const zone = zoneById(quest.zone);
  const karma = quest.baseKarma + quest.bonusKarma;
  const ratio = Math.max(0, Math.min(1, remainingMs / CLAIM_MS));
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const pending = quest.status === "PENDING";

  return (
    <div className="flex h-full flex-col bg-ink text-paper">
      <header className="flex items-center justify-between px-5 pt-5">
        <p className="text-xs uppercase tracking-[0.2em] text-leaf">{pending ? "Waiting confirm" : "Your walk"}</p>
        <button type="button" onClick={onClose} className="text-sm text-paper/50">
          Map
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6">
        <div className="mx-auto mt-6 grid place-items-center">
          <div
            className="grid h-36 w-36 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#d6ff4a ${ratio * 360}deg, #2a3524 0deg)`,
            }}
          >
            <div className="grid h-[7.6rem] w-[7.6rem] place-items-center rounded-full bg-ink">
              <p className="serif text-3xl tabular-nums text-leaf">
                {pending ? "—" : `${mm}:${ss}`}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.18em] text-paper/40">
          {pending ? "Requester confirms next" : "Then it unblocks for others"}
        </p>

        <h1 className="serif mt-8 text-4xl leading-tight">{quest.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-paper/70">{quest.detail}</p>
        <p className="mt-4 text-sm text-paper/50">
          {zone.name} · +{karma} karma · {quest.requesterName}
        </p>
      </div>

      {pending ? (
        <div className="px-5 pb-6">
          <p className="rounded-2xl bg-paper/8 p-4 text-sm text-paper/70">
            Marked done. Only {quest.requesterName} can confirm — that’s when karma actually moves.
          </p>
        </div>
      ) : (
        <div className="flex gap-2 px-5 pb-6">
          <button
            type="button"
            onClick={onBail}
            className="flex-1 rounded-full border border-paper/20 py-3 text-sm"
          >
            Can’t make it
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full bg-leaf py-3 text-sm font-semibold text-ink"
          >
            Mark done
          </button>
        </div>
      )}
    </div>
  );
}
