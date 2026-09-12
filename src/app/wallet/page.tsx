"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiMe } from "@/lib/api";
import { loadSession } from "@/lib/session";
import type { Session, Transaction } from "@/lib/types";

const seedTx: Transaction[] = [
  { id: "t1", label: "Confirmed · charger walk", amount: 30, when: "Today 01:12" },
  { id: "t2", label: "Posted · HDMI swap", amount: -20, when: "Today 00:48" },
  { id: "t3", label: "Confirmed · hold table", amount: 25, when: "Thu 23:10" },
];

export default function WalletPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tx, setTx] = useState<Transaction[]>(seedTx);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/join");
      return;
    }
    setSession(s);
    apiMe(s.id)
      .then((me) => {
        setSession(me.user);
        if (me.transactions.length) setTx(me.transactions);
      })
      .catch(() => undefined);
  }, [router]);

  if (!session) return null;

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link href="/map" className="text-xs uppercase tracking-[0.2em] text-leaf">
          Back to map
        </Link>
        <p className="mt-8 text-sm text-paper/55">
          {session.name} · {session.zone}
        </p>
        <h1 className="serif mt-2 text-6xl text-gold">{session.karma}</h1>
        <p className="mt-1 text-sm text-paper/50">karma · starts at 100 so asking stays cheap</p>

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
    </main>
  );
}
