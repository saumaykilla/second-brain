/**
 * Load the Orbit fixture into Atlas (S3 load script).
 *
 * Usage (after `npm install`, MONGODB_URI set, and indexes created):
 *   npm run build && node dist/scripts/load-fixtures.js
 *   # or: npx tsx src/scripts/load-fixtures.ts
 *
 * Idempotent per project: clears the fixture collections for PROJECT_ID first,
 * then inserts. This is the S3 stand-in; the real Orbit history (R30) is later
 * produced by running seed messages through the pipeline (A7 / f-db-02).
 */

import { getDb, closeClient } from "../db/client.js";
import { Collections } from "../types.js";
import { orbitFixture, PROJECT_ID } from "../fixtures/orbit.js";

async function main(): Promise<void> {
  const db = await getDb();

  const wipe = [
    Collections.attempts,
    Collections.decisions,
    Collections.edges,
    Collections.evidence,
    Collections.harnessConfigs,
  ];
  for (const name of wipe) {
    const res = await db.collection(name).deleteMany({ projectId: PROJECT_ID });
    console.log(`cleared ${res.deletedCount} from ${name} (project=${PROJECT_ID})`);
  }

  await db.collection(Collections.evidence).insertMany(orbitFixture.evidence as object[]);
  await db.collection(Collections.attempts).insertMany(orbitFixture.attempts as object[]);
  await db.collection(Collections.decisions).insertMany(orbitFixture.decisions as object[]);
  await db.collection(Collections.edges).insertMany(orbitFixture.edges as object[]);
  await db
    .collection(Collections.harnessConfigs)
    .insertMany(orbitFixture.harnessConfigs as object[]);

  console.log(
    `loaded orbit: ${orbitFixture.attempts.length} attempts, ` +
      `${orbitFixture.decisions.length} decisions, ${orbitFixture.edges.length} edges`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
