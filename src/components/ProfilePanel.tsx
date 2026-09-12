"use client";

import { zoneById } from "@/lib/data";
import type { Session, Transaction } from "@/lib/types";

type Props = {
  session: Session;
  tx: Transaction[];
  onClose: () => void;
};

export function ProfilePanel({ session, tx, onClose }: Props) {
  return (
    <div className="flex h-full flex-col bg-ink text-paper">
      <header className="flex items-center justify-between px-5 pt-5">
        <p className="text-xs uppercase tracking-[0.2em] text-leaf">You</p>
        <button type="button" onClick={onClose} className="text-sm text-paper/50">
          Map
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <p className="mt-6 text-sm text-paper/55">
          {session.name} · {zoneById(session.zone).name}
        </p>
        <h1 className="serif mt-2 text-6xl text-gold">{session.karma}</h1>
        <p className="mt-1 text-sm text-paper/45">
          karma · {session.completed} done · {session.bailed} released
        </p>

        <ul className="mt-10 divide-y divide-paper/10 border-t border-paper/10">
          {tx.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-4">
              <div>
                <p>{t.label}</p>
                <p className="text-xs text-paper/40">{t.when}</p>
              </div>
              <p className={t.amount > 0 ? "text-leaf" : "text-paper/70"}>
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
