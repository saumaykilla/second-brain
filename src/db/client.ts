/**
 * MongoDB Atlas client (S2). System of record (R34).
 *
 * Requires `mongodb` (declared in package.json). Install with `npm install`
 * before running any script that imports this module.
 */

import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and fill it in (S5)."
    );
  }
  return uri;
}

export async function getClient(): Promise<MongoClient> {
  if (client) return client;
  client = new MongoClient(getMongoUri());
  await client.connect();
  return client;
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  return c.db(process.env.MONGODB_DB ?? "projectbrain");
}

export async function closeClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
