/**
 * One-time seed: inserts MOCK_QUESTS into the quests collection.
 * Does not wipe users/transactions. Re-run is safe — duplicate ids are skipped.
 *
 *   npm run seed
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { MOCK_QUESTS } from "../src/lib/data";
import { getDb } from "../src/lib/db";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const db = await getDb();
  const col = db.collection("quests");
  let inserted = 0;
  let skipped = 0;

  for (const quest of MOCK_QUESTS) {
    const { id, ...rest } = quest;
    try {
      await col.insertOne({ _id: id, ...rest } as never);
      inserted += 1;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  const count = await col.countDocuments();
  console.log(`Seed complete. inserted=${inserted} skipped=${skipped} totalQuests=${count}`);
  console.log(`Using db=${db.databaseName}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
