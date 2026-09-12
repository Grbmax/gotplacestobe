"use client";

import { useEffect, useRef, useState } from "react";
import { zoneById } from "@/lib/data";
import type { ScoredQuest } from "@/lib/types";

type Props = {
  quest: ScoredQuest | null;
  next?: ScoredQuest | null;
  onSkip: () => void;
  onAccept: () => void;
};

export function SwipeDeck({ quest, next, onSkip, onAccept }: Props) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    setOpen(false);
    setDx(0);
  }, [quest?.id]);

  if (!quest) {
    return (
      <div className="rounded-3xl bg-paper p-6 text-ink shadow-2xl">
        <p className="serif text-2xl">Feed’s quiet.</p>
        <p className="mt-2 text-sm text-ink/60">Post something small. That’s how this stays alive.</p>
      </div>
    );
  }

  const karma = quest.baseKarma + quest.bonusKarma;
  const zone = zoneById(quest.zone);

  function pointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function pointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  }

  function pointerUp() {
    setDragging(false);
    if (dx > 90) onAccept();
    else if (dx < -90) onSkip();
    else setDx(0);
  }

  const rotate = dx / 18;
  const skipOp = Math.min(1, Math.max(0, -dx / 120));
  const takeOp = Math.min(1, Math.max(0, dx / 120));

  return (
    <div className="relative">
      {next && (
        <div className="absolute inset-x-3 top-3 h-full rounded-3xl bg-paper/70 shadow-lg" />
      )}
      <article
        className="relative overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl touch-none"
        style={{
          transform: `translateX(${dx}px) rotate(${rotate}deg)`,
          transition: dragging ? "none" : "transform 180ms ease",
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-between p-4 text-xs font-semibold tracking-widest uppercase"
          style={{ opacity: Math.max(skipOp, takeOp) }}
        >
          <span className="rounded-full border-2 border-ink px-3 py-1" style={{ opacity: skipOp }}>
            Skip
          </span>
          <span className="rounded-full bg-leaf px-3 py-1 text-ink" style={{ opacity: takeOp }}>
            Take
          </span>
        </div>

        <button
          type="button"
          className="w-full px-5 pt-5 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-ink/50">
            <span>
              {zone.short} · {quest.minutesAway === 0 ? "here" : `${quest.minutesAway} min`}
            </span>
            <span className={quest.urgency === "urgent" ? "text-urgent" : "text-ink/50"}>
              {quest.urgency}
            </span>
          </div>
          <h2 className="serif mt-2 text-[1.45rem] leading-tight">{quest.title}</h2>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-sm text-gold">
            +{karma} karma
            {quest.bonusKarma > 0 ? (
              <span className="text-leaf/90">
                {" "}
                · +{quest.bonusKarma} {quest.urgency === "urgent" ? "urgent" : "boost"}
              </span>
            ) : null}
          </p>
          <p className="mt-3 text-sm text-ink/60">{quest.why}</p>
        </button>

        {open && (
          <div className="mx-5 mt-3 rounded-2xl bg-ink/5 p-4 text-sm leading-relaxed text-ink/80">
            <p>{quest.detail}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink/45">
              Posted by {quest.requesterName} · {quest.createdAt}
            </p>
            <p className="mt-2 text-xs text-ink/50">
              Only {quest.requesterName} can confirm you did it. Bailing shows up in other people’s feeds.
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2 p-4 pt-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onSkip}
            className="flex-1 rounded-full border border-ink/15 py-3 text-sm font-medium"
          >
            Not now
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-ink/15 px-4 py-3 text-sm"
          >
            {open ? "Less" : "Details"}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAccept}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-medium text-leaf"
          >
            I’ll take it
          </button>
        </div>
      </article>
    </div>
  );
}
