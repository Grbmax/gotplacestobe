import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  return uri;
}

function getClientPromise() {
  if (!globalForMongo._mongoClientPromise) {
    // Vercel serverless → Atlas over IPv6 can fail TLS with "SSL alert number 80".
    // Force IPv4 so the handshake succeeds.
    const client = new MongoClient(getUri(), { family: 4 });
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export function hasMongo() {
  return Boolean(process.env.MONGODB_URI);
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db("scan");
}

/** Isolated cribCheck DB so inspect collections never collide with Quest. */
export async function getScanDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db("scan");
}
