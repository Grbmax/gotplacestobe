import { CLAIM_MS, KARMA_COST, zoneById } from "./data";
import { getDb } from "./db";
import type { Quest, Session, Transaction, Urgency, ZoneId } from "./types";

type UserDoc = Omit<Session, "id"> & { _id: string };
type QuestDoc = Omit<Quest, "id"> & { _id: string };
type TxDoc = Omit<Transaction, "id"> & { _id: string; ownerId: string };

function stamp() {
  return Date.now();
}

function asUser(doc: UserDoc): Session {
  return {
    id: doc._id,
    name: doc.name,
    zone: doc.zone,
    karma: doc.karma,
    completed: doc.completed,
    bailed: doc.bailed,
  };
}

function asQuest(doc: QuestDoc): Quest {
  return {
    id: doc._id,
    requesterId: doc.requesterId,
    requesterName: doc.requesterName,
    helperId: doc.helperId,
    helperName: doc.helperName,
    title: doc.title,
    detail: doc.detail,
    zone: doc.zone,
    lat: doc.lat,
    lng: doc.lng,
    urgency: doc.urgency,
    baseKarma: doc.baseKarma,
    bonusKarma: doc.bonusKarma,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    claimedAt: doc.claimedAt,
  };
}

function asTx(doc: TxDoc): Transaction {
  return {
    id: doc._id,
    fromUserId: doc.fromUserId,
    toUserId: doc.toUserId,
    questId: doc.questId,
    label: doc.label,
    amount: doc.amount,
    when: doc.when,
  };
}

async function expireStaleClaims() {
  const db = await getDb();
  const now = stamp();
  const cutoff = now - CLAIM_MS;
  const stale = await db
    .collection<QuestDoc>("quests")
    .find({ status: "CLAIMED", claimedAt: { $lte: cutoff } })
    .toArray();

  for (const quest of stale) {
    if (quest.helperId) {
      await db.collection<UserDoc>("users").updateOne({ _id: quest.helperId }, { $inc: { bailed: 1 } });
    }
  }

  if (stale.length) {
    await db.collection<QuestDoc>("quests").updateMany(
      { status: "CLAIMED", claimedAt: { $lte: cutoff } },
      {
        $set: { status: "OPEN", updatedAt: now },
        $unset: { helperId: "", helperName: "", claimedAt: "" },
      },
    );
  }
}

export async function createUser(name: string, zone: ZoneId): Promise<Session> {
  const db = await getDb();
  const user: UserDoc = {
    _id: crypto.randomUUID(),
    name,
    zone,
    karma: 100,
    completed: 3,
    bailed: 0,
  };
  await db.collection<UserDoc>("users").insertOne(user);

  const seedTx: TxDoc[] = [
    {
      _id: `t1_${user._id}`,
      ownerId: user._id,
      label: "Confirmed · charger walk",
      amount: 30,
      when: "Today 01:12",
    },
    {
      _id: `t2_${user._id}`,
      ownerId: user._id,
      label: "Posted · HDMI swap",
      amount: -20,
      when: "Today 00:48",
    },
    {
      _id: `t3_${user._id}`,
      ownerId: user._id,
      label: "Confirmed · hold table",
      amount: 25,
      when: "Thu 23:10",
    },
  ];
  await db.collection<TxDoc>("transactions").insertMany(seedTx);
  return asUser(user);
}

export async function getUser(id: string): Promise<Session | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ _id: id });
  return doc ? asUser(doc) : null;
}

export async function listQuests(since?: number) {
  await expireStaleClaims();
  const db = await getDb();
  const filter = since ? { updatedAt: { $gt: since } } : {};
  const docs = await db.collection<QuestDoc>("quests").find(filter).sort({ updatedAt: -1 }).toArray();
  return { quests: docs.map(asQuest), serverTime: stamp() };
}

export async function createQuest(input: {
  userId: string;
  title: string;
  zone: ZoneId;
  urgency: Urgency;
}) {
  const db = await getDb();
  const userDoc = await db.collection<UserDoc>("users").findOne({ _id: input.userId });
  if (!userDoc) return { error: "Unknown session" as const };

  const cost = KARMA_COST[input.urgency];
  const total = cost.base + cost.bonus;
  if (userDoc.karma < total) return { error: "Not enough karma" as const };

  const now = stamp();
  const title = input.title.trim() || "Need a hand nearby";
  const z = zoneById(input.zone);
  const jitter = (seed: number) => ((seed % 17) - 8) * 0.00003;
  const quest: QuestDoc = {
    _id: `q_${now}`,
    requesterId: userDoc._id,
    requesterName: userDoc.name,
    title,
    detail: `${title} · posted from ${userDoc.zone}. Only ${userDoc.name} can confirm.`,
    zone: input.zone,
    lat: z.lat + jitter(now),
    lng: z.lng + jitter(now >> 2),
    urgency: input.urgency,
    baseKarma: cost.base,
    bonusKarma: cost.bonus,
    status: "OPEN",
    createdAt: "just now",
    updatedAt: now,
  };

  const updated = await db.collection<UserDoc>("users").findOneAndUpdate(
    { _id: userDoc._id, karma: { $gte: total } },
    { $inc: { karma: -total } },
    { returnDocument: "after" },
  );
  if (!updated) return { error: "Not enough karma" as const };

  await db.collection<QuestDoc>("quests").insertOne(quest);

  const tx: TxDoc = {
    _id: `tx_${now}`,
    ownerId: userDoc._id,
    fromUserId: userDoc._id,
    questId: quest._id,
    label: `Posted · ${quest.title}`,
    amount: -total,
    when: "Just now",
  };
  await db.collection<TxDoc>("transactions").insertOne(tx);
  return { quest: asQuest(quest), user: asUser(updated) };
}

export async function claimQuest(id: string, userId: string) {
  const db = await getDb();
  const userDoc = await db.collection<UserDoc>("users").findOne({ _id: userId });
  if (!userDoc) return { error: "Not found" as const };

  const existing = await db.collection<QuestDoc>("quests").findOne({ _id: id });
  if (!existing) return { error: "Not found" as const };
  if (existing.status !== "OPEN") return { error: "Already taken" as const };
  if (existing.requesterId === userDoc._id) return { error: "That’s your quest" as const };

  const now = stamp();
  const updated = await db.collection<QuestDoc>("quests").findOneAndUpdate(
    { _id: id, status: "OPEN" },
    {
      $set: {
        status: "CLAIMED",
        helperId: userDoc._id,
        helperName: userDoc.name,
        claimedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) return { error: "Already taken" as const };
  return { quest: asQuest(updated), user: asUser(userDoc) };
}

export async function bailQuest(id: string, userId: string) {
  await expireStaleClaims();
  const db = await getDb();
  const userDoc = await db.collection<UserDoc>("users").findOne({ _id: userId });
  if (!userDoc) return { error: "Not found" as const };

  const quest = await db.collection<QuestDoc>("quests").findOne({ _id: id });
  if (!quest) return { error: "Not found" as const };
  if (quest.status !== "CLAIMED" || quest.helperId !== userDoc._id) {
    return { error: "Not your claim" as const };
  }

  const now = stamp();
  const updatedQuest = await db.collection<QuestDoc>("quests").findOneAndUpdate(
    { _id: id, status: "CLAIMED", helperId: userDoc._id },
    {
      $set: { status: "OPEN", updatedAt: now },
      $unset: { helperId: "", helperName: "", claimedAt: "" },
    },
    { returnDocument: "after" },
  );
  if (!updatedQuest) return { error: "Not your claim" as const };

  const updatedUser = await db.collection<UserDoc>("users").findOneAndUpdate(
    { _id: userDoc._id },
    { $inc: { bailed: 1 } },
    { returnDocument: "after" },
  );
  if (!updatedUser) return { error: "Not found" as const };
  return { quest: asQuest(updatedQuest), user: asUser(updatedUser) };
}

export async function markDone(id: string, userId: string) {
  await expireStaleClaims();
  const db = await getDb();
  const userDoc = await db.collection<UserDoc>("users").findOne({ _id: userId });
  if (!userDoc) return { error: "Not found" as const };

  const quest = await db.collection<QuestDoc>("quests").findOne({ _id: id });
  if (!quest) return { error: "Not found" as const };
  if (quest.status !== "CLAIMED" || quest.helperId !== userDoc._id) {
    return { error: "Not your claim" as const };
  }

  const now = stamp();
  const updated = await db.collection<QuestDoc>("quests").findOneAndUpdate(
    { _id: id, status: "CLAIMED", helperId: userDoc._id },
    { $set: { status: "PENDING", updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!updated) return { error: "Not your claim" as const };
  return { quest: asQuest(updated), user: asUser(userDoc) };
}

export async function confirmQuest(id: string, userId: string) {
  const db = await getDb();
  const quest = await db.collection<QuestDoc>("quests").findOne({ _id: id });
  if (!quest) return { error: "Not found" as const };
  if (quest.status !== "PENDING") return { error: "Not pending" as const };
  if (quest.requesterId !== userId) {
    return { error: "Only the requester can confirm" as const };
  }
  if (!quest.helperId) return { error: "Not found" as const };

  const helperDoc = await db.collection<UserDoc>("users").findOne({ _id: quest.helperId });
  if (!helperDoc) return { error: "Not found" as const };

  const total = quest.baseKarma + quest.bonusKarma;
  const now = stamp();

  const updatedQuest = await db.collection<QuestDoc>("quests").findOneAndUpdate(
    { _id: id, status: "PENDING", requesterId: userId },
    { $set: { status: "CONFIRMED", updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!updatedQuest) return { error: "Not pending" as const };

  const helper = await db.collection<UserDoc>("users").findOneAndUpdate(
    { _id: helperDoc._id },
    { $inc: { karma: total, completed: 1 } },
    { returnDocument: "after" },
  );
  if (!helper) return { error: "Not found" as const };

  const transaction: TxDoc = {
    _id: `tx_${now}`,
    ownerId: helper._id,
    toUserId: helper._id,
    questId: updatedQuest._id,
    label: `Confirmed · ${updatedQuest.title}`,
    amount: total,
    when: "Just now",
  };
  await db.collection<TxDoc>("transactions").insertOne(transaction);
  return { quest: asQuest(updatedQuest), user: asUser(helper), transaction: asTx(transaction) };
}

export async function getMe(userId: string) {
  const db = await getDb();
  const userDoc = await db.collection<UserDoc>("users").findOne({ _id: userId });
  if (!userDoc) return null;
  const txs = await db
    .collection<TxDoc>("transactions")
    .find({ ownerId: userId })
    .sort({ _id: -1 })
    .toArray();
  return { user: asUser(userDoc), transactions: txs.map(asTx) };
}
