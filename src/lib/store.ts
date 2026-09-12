import { CLAIM_MS, KARMA_COST, MOCK_QUESTS } from "./data";
import type { Quest, Session, Transaction, Urgency, ZoneId } from "./types";

const quests: Quest[] = structuredClone(MOCK_QUESTS);
const users = new Map<string, Session>();
const transactions = new Map<string, Transaction[]>();

function stamp() {
  return Date.now();
}

export function createUser(name: string, zone: ZoneId): Session {
  const user: Session = {
    id: crypto.randomUUID(),
    name,
    zone,
    karma: 100,
    completed: 3,
    bailed: 0,
  };
  users.set(user.id, user);
  transactions.set(user.id, [
    { id: "t1", label: "Confirmed · charger walk", amount: 30, when: "Today 01:12" },
    { id: "t2", label: "Posted · HDMI swap", amount: -20, when: "Today 00:48" },
    { id: "t3", label: "Confirmed · hold table", amount: 25, when: "Thu 23:10" },
  ]);
  return user;
}

export function getUser(id: string) {
  return users.get(id) ?? null;
}

function expireStaleClaims() {
  const now = stamp();
  for (const quest of quests) {
    if (quest.status !== "CLAIMED" || !quest.claimedAt) continue;
    if (now - quest.claimedAt < CLAIM_MS) continue;
    const helper = quest.helperId ? users.get(quest.helperId) : undefined;
    if (helper) helper.bailed += 1;
    quest.status = "OPEN";
    quest.helperId = undefined;
    quest.helperName = undefined;
    quest.claimedAt = undefined;
    quest.updatedAt = now;
  }
}

export function listQuests(since?: number) {
  expireStaleClaims();
  const filtered = since ? quests.filter((q) => q.updatedAt > since) : quests;
  return { quests: filtered, serverTime: stamp() };
}

export function createQuest(input: {
  userId: string;
  title: string;
  zone: ZoneId;
  urgency: Urgency;
}) {
  const user = users.get(input.userId);
  if (!user) return { error: "Unknown session" as const };

  const cost = KARMA_COST[input.urgency];
  const total = cost.base + cost.bonus;
  if (user.karma < total) return { error: "Not enough karma" as const };

  user.karma -= total;
  const quest: Quest = {
    id: `q_${stamp()}`,
    requesterId: user.id,
    requesterName: user.name,
    title: input.title.trim() || "Need a hand nearby",
    detail: `${input.title.trim() || "Need a hand nearby"} · posted from ${user.zone}. Only ${user.name} can confirm.`,
    zone: input.zone,
    urgency: input.urgency,
    baseKarma: cost.base,
    bonusKarma: cost.bonus,
    status: "OPEN",
    createdAt: "just now",
    updatedAt: stamp(),
  };
  quests.unshift(quest);
  const tx: Transaction = {
    id: `tx_${stamp()}`,
    fromUserId: user.id,
    questId: quest.id,
    label: `Posted · ${quest.title}`,
    amount: -total,
    when: "Just now",
  };
  transactions.set(user.id, [tx, ...(transactions.get(user.id) ?? [])]);
  return { quest, user };
}

export function claimQuest(id: string, userId: string) {
  const user = users.get(userId);
  const quest = quests.find((q) => q.id === id);
  if (!user || !quest) return { error: "Not found" as const };
  if (quest.status !== "OPEN") return { error: "Already taken" as const };
  if (quest.requesterId === user.id) return { error: "That’s your quest" as const };

  quest.status = "CLAIMED";
  quest.helperId = user.id;
  quest.helperName = user.name;
  quest.claimedAt = stamp();
  quest.updatedAt = quest.claimedAt;
  return { quest, user };
}

export function bailQuest(id: string, userId: string) {
  expireStaleClaims();
  const user = users.get(userId);
  const quest = quests.find((q) => q.id === id);
  if (!user || !quest) return { error: "Not found" as const };
  if (quest.status !== "CLAIMED" || quest.helperId !== user.id) {
    return { error: "Not your claim" as const };
  }

  user.bailed += 1;
  quest.status = "OPEN";
  quest.helperId = undefined;
  quest.helperName = undefined;
  quest.claimedAt = undefined;
  quest.updatedAt = stamp();
  return { quest, user };
}

export function markDone(id: string, userId: string) {
  expireStaleClaims();
  const user = users.get(userId);
  const quest = quests.find((q) => q.id === id);
  if (!user || !quest) return { error: "Not found" as const };
  if (quest.status !== "CLAIMED" || quest.helperId !== user.id) {
    return { error: "Not your claim" as const };
  }

  quest.status = "PENDING";
  quest.updatedAt = stamp();
  return { quest, user };
}

export function getMe(userId: string) {
  const user = users.get(userId);
  if (!user) return null;
  return { user, transactions: transactions.get(userId) ?? [] };
}
