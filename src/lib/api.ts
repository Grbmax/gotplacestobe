import type { Quest, Session, Transaction, Urgency, ZoneId } from "./types";
import type { ChainResult } from "./chain";

export async function apiCreateSession(name: string, zone: ZoneId) {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, zone }),
  });
  if (!res.ok) throw new Error("session");
  return (await res.json()) as { user: Session };
}

export async function apiListQuests(userId: string, since?: number) {
  const qs = new URLSearchParams({ userId });
  if (since) qs.set("since", String(since));
  const res = await fetch(`/api/quests?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("quests");
  return (await res.json()) as { quests: Quest[]; serverTime: number };
}

export async function apiCreateQuest(input: {
  userId: string;
  title: string;
  zone: ZoneId;
  urgency: Urgency;
}) {
  const res = await fetch("/api/quests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { quest?: Quest; user?: Session; error?: string };
  if (!res.ok || !data.quest || !data.user) throw new Error(data.error ?? "create");
  return { quest: data.quest, user: data.user };
}

export async function apiClaimQuest(id: string, userId: string) {
  const res = await fetch(`/api/quests/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json()) as { quest?: Quest; error?: string };
  if (!res.ok || !data.quest) throw new Error(data.error ?? "claim");
  return data;
}

export async function apiBailQuest(id: string, userId: string) {
  const res = await fetch(`/api/quests/${id}/bail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json()) as { quest?: Quest; user?: Session; error?: string };
  if (!res.ok || !data.quest) throw new Error(data.error ?? "bail");
  return data;
}

export async function apiMarkDone(id: string, userId: string) {
  const res = await fetch(`/api/quests/${id}/done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json()) as { quest?: Quest; error?: string };
  if (!res.ok || !data.quest) throw new Error(data.error ?? "done");
  return data;
}

export async function apiConfirmQuest(id: string, userId: string) {
  const res = await fetch(`/api/quests/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json()) as {
    quest?: Quest;
    user?: Session;
    transaction?: Transaction;
    error?: string;
  };
  if (!res.ok || !data.quest) throw new Error(data.error ?? "confirm");
  return data;
}

export async function apiMe(userId: string) {
  const res = await fetch(`/api/me?userId=${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("me");
  return (await res.json()) as { user: Session; transactions: Transaction[] };
}

export async function apiChain() {
  const res = await fetch("/api/chain", { cache: "no-store" });
  if (!res.ok) throw new Error("chain");
  return (await res.json()) as { chain: ChainResult | null };
}
