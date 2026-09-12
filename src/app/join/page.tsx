"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCreateSession } from "@/lib/api";
import { ZONES } from "@/lib/data";
import { createSession, saveSession } from "@/lib/session";
import type { ZoneId } from "@/lib/types";

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zone, setZone] = useState<ZoneId>("tepper-2f");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim() || "Guest";
    setBusy(true);
    const local = createSession(trimmed, zone);
    try {
      const { user } = await apiCreateSession(trimmed, zone);
      saveSession(user);
    } catch {
      saveSession(local);
    }
    router.push("/map");
  }

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <p className="text-xs uppercase tracking-[0.28em] text-leaf">This building</p>
        <h1 className="serif mt-3 text-5xl leading-none">Name, zone, you’re in.</h1>
        <p className="mt-4 text-sm text-paper/60">
          Session lives on this phone. Karma starts at 100 so asking is never blocked.
        </p>

        <form onSubmit={submit} className="mt-10 flex flex-1 flex-col">
          <label className="text-xs uppercase tracking-[0.2em] text-paper/45">What should we call you</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maya"
            className="mt-2 border-b border-paper/20 bg-transparent py-3 text-2xl outline-none placeholder:text-paper/25"
          />

          <p className="mt-10 text-xs uppercase tracking-[0.2em] text-paper/45">You’re standing in</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {ZONES.map((z) => (
              <button
                type="button"
                key={z.id}
                onClick={() => setZone(z.id)}
                className={`rounded-2xl px-4 py-3 text-left ${
                  zone === z.id ? "bg-leaf text-ink" : "bg-paper/8 text-paper"
                }`}
              >
                <span className="block text-sm font-medium">{z.name}</span>
                <span className={`text-xs ${zone === z.id ? "text-ink/60" : "text-paper/45"}`}>
                  Live pin starts here — matching stays zone-based
                </span>
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-auto rounded-full bg-leaf py-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Opening map…" : "Open the map"}
          </button>
        </form>
      </div>
    </main>
  );
}
