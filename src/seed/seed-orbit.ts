/**
 * Seed Orbit through the REAL pipeline (A7, f-db-02).
 *
 * Runs ~150 messages through ingestMessage() so attempts/decisions are produced
 * by extraction, not inserted as finished records. Returns a summary so callers
 * (script or test) can assert the expected shape of the seeded project.
 *
 * Offline by default (in-memory store); pass Atlas-backed deps to seed a real DB.
 */

import type { IngestOptions } from "../pipeline/index.js";
import { ingestMessage } from "../pipeline/index.js";
import { buildOrbitCorpus, ORBIT_PROJECT_ID } from "./orbit-messages.js";
import type { InMemoryStore } from "../pipeline/store.js";

export interface SeedSummary {
  projectId: string;
  totalMessages: number;
  attempts: number;
  decisions: number;
  merged: number;
  byKind: Record<string, number>;
}

export async function seedOrbit(options: IngestOptions = {}): Promise<SeedSummary> {
  const corpus = buildOrbitCorpus();
  const byKind: Record<string, number> = {};
  let attempts = 0;
  let decisions = 0;
  let merged = 0;

  for (const input of corpus) {
    const r = await ingestMessage(input, options);
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    if (r.attempt && !r.merged) attempts += 1;
    if (r.merged) merged += 1;
    if (r.decision) decisions += 1;
  }

  return {
    projectId: ORBIT_PROJECT_ID,
    totalMessages: corpus.length,
    attempts,
    decisions,
    merged,
    byKind,
  };
}

/** Read the distinct attempts a store ended up with (offline verification). */
export function countStoreAttempts(store: InMemoryStore): number {
  return store.attempts.filter((a) => a.projectId === ORBIT_PROJECT_ID).length;
}
