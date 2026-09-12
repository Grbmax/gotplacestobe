"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiCreateQuest, apiCreateSession } from "@/lib/api";
import { KARMA_COST, zoneById } from "@/lib/data";
import { loadSession, saveSession } from "@/lib/session";
import type { Session, Urgency } from "@/lib/types";

export default function CreatePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("Need a charger walk from the library");
  const [urgency, setUrgency] = useState<Urgency>("urgent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/join");
      return;
    }
    setSession(s);
  }, [router]);

  const cost = KARMA_COST[urgency];
  const total = cost.base + cost.bonus;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = session ?? loadSession();
    if (!s) return;
    setBusy(true);
    setError(null);
    const zone = s.zone;
    try {
      let user = s;
      try {
        const created = await apiCreateQuest({
          userId: user.id,
          title,
          zone,
          urgency,
        });
        saveSession(created.user);
        router.push("/map");
        return;
      } catch {
        const registered = await apiCreateSession(user.name, user.zone);
        user = registered.user;
        saveSession(user);
        setSession(user);
        const created = await apiCreateQuest({
          userId: user.id,
          title,
          zone: user.zone,
          urgency,
        });
        saveSession(created.user);
        router.push("/map");
      }
    } catch {
      setError("Couldn’t put it on the map. Try again.");
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <form onSubmit={submit} className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
        <button type="button" onClick={() => router.back()} className="text-left text-xs uppercase tracking-[0.2em] text-ink/45">
          Back to map
        </button>
        <h1 className="serif mt-4 text-4xl">Post something small and now.</h1>
        <p className="mt-2 text-sm text-ink/55">
          Cost comes off your balance immediately and sits in escrow until you confirm.
        </p>

        <label className="mt-8 text-xs uppercase tracking-[0.18em] text-ink/45">The ask</label>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={3}
          className="mt-2 rounded-2xl border border-ink/10 bg-white p-4 text-lg outline-none"
        />

        <div className="mt-6 rounded-2xl bg-ink/5 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Where it needs doing</p>
          <p className="mt-1 text-sm font-medium">{zoneById(session.zone).name}</p>
          <p className="mt-0.5 text-xs text-ink/45">Pinned to your auto-detected zone</p>
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-ink/45">Urgency</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["low", "medium", "urgent"] as Urgency[]).map((u) => (
            <button
              type="button"
              key={u}
              onClick={() => setUrgency(u)}
              className={`rounded-2xl py-3 text-sm capitalize ${
                urgency === u ? "bg-gold text-ink" : "bg-ink/5"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="mt-auto rounded-3xl bg-ink p-5 text-paper">
          <p className="text-xs uppercase tracking-[0.18em] text-paper/45">You’ll escrow</p>
          <p className="serif text-4xl text-gold">
            {total} <span className="text-xl text-paper/50">/ {session.karma} k</span>
          </p>
          <p className="mt-1 text-xs text-paper/50">
            {cost.base} base{cost.bonus ? ` + ${cost.bonus} urgency` : ""}
          </p>
          {error && <p className="mt-2 text-xs text-urgent">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-full bg-leaf py-3 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Posting…" : "Put it on the map"}
          </button>
        </div>
      </form>
    </main>
  );
}
