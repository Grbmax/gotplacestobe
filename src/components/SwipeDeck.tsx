"use client";

import { useEffect, useRef, useState } from "react";
import { zoneById } from "@/lib/data";
import type { ScoredQuest } from "@/lib/types";

type Props = {
  feed: ScoredQuest[];
  index: number;
  onIndexChange: (i: number) => void;
  onAccept: (id: string) => void;
};

function Card({
  quest,
  onNotNow,
  onAccept,
}: {
  quest: ScoredQuest;
  onNotNow: () => void;
  onAccept: () => void;
}) {
  const [open, setOpen] = useState(false);
  const karma = quest.baseKarma + quest.bonusKarma;
  const zone = zoneById(quest.zone);

  return (
    <article className="relative w-full shrink-0 snap-center overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl">
      <button type="button" className="w-full px-5 pt-5 text-left" onClick={() => setOpen((v) => !v)}>
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
          onClick={onNotNow}
          className="flex-1 rounded-full border border-ink/15 py-3 text-sm font-medium"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-ink/15 px-4 py-3 text-sm"
        >
          {open ? "Less" : "Details"}
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-full bg-ink py-3 text-sm font-medium text-leaf"
        >
          I’ll take it
        </button>
      </div>
    </article>
  );
}

export function SwipeDeck({ feed, index, onIndexChange, onAccept }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const suppressScroll = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    const card = cardRefs.current[index];
    if (!el || !card) return;
    suppressScroll.current = true;
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    const t = window.setTimeout(() => {
      suppressScroll.current = false;
    }, 320);
    return () => window.clearTimeout(t);
  }, [index]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !feed.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressScroll.current) return;
        let best: { i: number; ratio: number } | null = null;
        for (const entry of entries) {
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isFinite(i)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { i, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.55 && best.i !== index) {
          onIndexChange(best.i);
        }
      },
      { root, threshold: [0.55, 0.75, 0.9] },
    );

    for (const node of cardRefs.current) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [feed, index, onIndexChange]);

  if (!feed.length) {
    return (
      <div className="rounded-3xl bg-paper p-6 text-ink shadow-2xl">
        <p className="serif text-2xl">Feed’s quiet.</p>
        <p className="mt-2 text-sm text-ink/60">Post something small. That’s how this stays alive.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {feed.map((quest, i) => (
          <div
            key={quest.id}
            data-index={i}
            ref={(node) => {
              cardRefs.current[i] = node;
            }}
            className="w-full shrink-0 snap-center"
          >
            <Card
              quest={quest}
              onNotNow={() => {
                if (i < feed.length - 1) onIndexChange(i + 1);
              }}
              onAccept={() => onAccept(quest.id)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {feed.map((q, i) => (
          <button
            key={q.id}
            type="button"
            aria-label={`Go to favor ${i + 1}`}
            onClick={() => onIndexChange(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-4 bg-leaf" : "w-1.5 bg-paper/35"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
