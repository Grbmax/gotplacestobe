"use client";

import { useState } from "react";
import { KARMA_COST, ZONES } from "@/lib/data";
import type { Session, Urgency, ZoneId } from "@/lib/types";

type Props = {
  session: Session;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { title: string; zone: ZoneId; urgency: Urgency }) => void;
};

export function QuickPost({ session, busy, error, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState<ZoneId>(session.zone);
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const cost = KARMA_COST[urgency];
  const total = cost.base + cost.bonus;

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex items-center justify-between px-5 pt-5">
        <p className="text-xs uppercase tracking-[0.2em] text-ink/45">New quest</p>
        <button type="button" onClick={onClose} className="text-sm text-ink/50">
          Close
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <h1 className="serif mt-3 text-4xl leading-none">Ask for something small.</h1>
        <p className="mt-2 text-sm text-ink/55">Lands on the live map near you. No extra screens.</p>

        <textarea
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Grab my charger from the library…"
          rows={3}
          className="mt-6 w-full rounded-2xl border border-ink/10 bg-white p-4 text-lg outline-none"
        />

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-ink/45">Where</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ZONES.map((z) => (
            <button
              type="button"
              key={z.id}
              onClick={() => setZone(z.id)}
              className={`rounded-full px-3 py-2 text-sm ${zone === z.id ? "bg-ink text-leaf" : "bg-ink/5"}`}
            >
              {z.short}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-ink/45">Urgency</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["low", "medium", "urgent"] as Urgency[]).map((u) => (
            <button
              type="button"
              key={u}
              onClick={() => setUrgency(u)}
              className={`rounded-2xl py-3 text-sm capitalize ${urgency === u ? "bg-gold text-ink" : "bg-ink/5"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-ink/10 bg-ink p-5 text-paper">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-paper/45">Escrow</p>
            <p className="serif text-3xl text-gold">
              {total} <span className="text-base text-paper/40">/ {session.karma}</span>
            </p>
          </div>
          {error && <p className="max-w-[12rem] text-right text-xs text-urgent">{error}</p>}
        </div>
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => onSubmit({ title: title.trim(), zone, urgency })}
          className="mt-4 w-full rounded-full bg-leaf py-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Posting…" : "Put it on the map"}
        </button>
      </div>
    </div>
  );
}
