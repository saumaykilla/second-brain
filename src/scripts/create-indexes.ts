/**
 * Create all ProjectBrain collections and indexes on Atlas (S2).
 *
 * Usage (after `npm install` and setting MONGODB_URI):
 *   npm run build && node dist/scripts/create-indexes.js
 *   # or with tsx: npx tsx src/scripts/create-indexes.ts
 *
 * Idempotent: safe to re-run. Standard indexes are created via createIndexes;
 * Atlas Search / Vector indexes via the Search Index management API
 * (client.db().collection().createSearchIndexes), which requires Atlas.
 */

import { getDb, closeClient } from "../db/client.js";
import {
  COLLECTION_NAMES,
  STANDARD_INDEXES,
  VECTOR_INDEXES,
  TEXT_INDEXES,
} from "../db/schema.js";

async function main(): Promise<void> {
  const db = await getDb();

  // 1. Ensure collections exist (so isolation & reads are predictable).
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const name of COLLECTION_NAMES) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      console.log(`created collection ${name}`);
    } else {
      console.log(`collection ${name} already exists`);
    }
  }

  // 2. Standard indexes: { projectId, createdAt }, edges.from/to, etc.
  for (const idx of STANDARD_INDEXES) {
    await db.collection(idx.collection).createIndex(idx.keys, {
      name: idx.name,
      unique: idx.unique ?? false,
    });
    console.log(`index ${idx.collection}.${idx.name} ready`);
  }

  // 3. Atlas Vector Search + Search indexes.
  for (const idx of [...VECTOR_INDEXES, ...TEXT_INDEXES]) {
    try {
      await db.collection(idx.collection).createSearchIndex({
        name: idx.name,
        type: idx.type,
        definition: idx.definition,
      } as unknown as Parameters<
        ReturnType<typeof db.collection>["createSearchIndex"]
      >[0]);
      console.log(`search index ${idx.collection}.${idx.name} (${idx.type}) requested`);
    } catch (err) {
      // Search indexes require an Atlas cluster; on a local mongod this throws.
      console.warn(
        `search index ${idx.collection}.${idx.name} skipped: ${(err as Error).message}`
      );
    }
  }

  console.log("done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
