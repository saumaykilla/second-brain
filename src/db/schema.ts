/**
 * ProjectBrain — Atlas collection & index definitions (S2).
 *
 * Declarative, dependency-free description of every collection and index the
 * system needs. `scripts/create-indexes.ts` applies these against a live Atlas
 * cluster; keeping them as data lets us review/diff them without a DB connection.
 *
 * Indexes required by the task (S2):
 *   - vector search on attempts.embedding (and decisions.embedding)
 *   - text search on attempts / decisions
 *   - compound { projectId, createdAt } on the time-ordered collections
 *   - edges.from and edges.to
 */

import { Collections } from "../types.js";

// Minimal env accessor so this file type-checks without @types/node. At runtime
// `globalThis.process` is present under Node; scripts install @types/node for the
// full tsconfig build.
const env: Record<string, string | undefined> =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env ?? {};

const EMBEDDING_DIMS = Number(env.OPENAI_EMBEDDING_DIMS ?? "1536");

/** A standard (btree) index spec. */
export interface StandardIndexDef {
  collection: string;
  name: string;
  /** Mongo key spec, e.g. { projectId: 1, createdAt: -1 }. */
  keys: Record<string, 1 | -1>;
  unique?: boolean;
}

/** An Atlas Search / Vector Search index (created via the Search Index API). */
export interface SearchIndexDef {
  collection: string;
  name: string;
  type: "vectorSearch" | "search";
  definition: Record<string, unknown>;
}

/** Every collection we create up front so isolation & reads are predictable. */
export const COLLECTION_NAMES: string[] = Object.values(Collections);

/**
 * Compound { projectId, createdAt } on the time-ordered, project-scoped collections.
 * These back the timeline and every project-isolated read (R1, R23).
 */
export const STANDARD_INDEXES: StandardIndexDef[] = [
  // { projectId, createdAt } across the time-ordered collections
  ...(
    [
      Collections.messages,
      Collections.attempts,
      Collections.decisions,
      Collections.entities,
      Collections.edges,
      Collections.evidence,
      Collections.warnings,
      Collections.feedback,
      Collections.evals,
    ] as const
  ).map((collection) => ({
    collection,
    name: "projectId_createdAt",
    keys: { projectId: 1, createdAt: -1 } as Record<string, 1 | -1>,
  })),

  // edges.from and edges.to graph traversal (R6, R28)
  {
    collection: Collections.edges,
    name: "edges_from",
    keys: { projectId: 1, from: 1, type: 1 },
  },
  {
    collection: Collections.edges,
    name: "edges_to",
    keys: { projectId: 1, to: 1, type: 1 },
  },

  // attempt lookups by outcome/status for the dead-end filter (R12)
  {
    collection: Collections.attempts,
    name: "attempts_outcome_status",
    keys: { projectId: 1, outcome: 1, status: 1 },
  },

  // one active harness version per project (R19)
  {
    collection: Collections.harnessConfigs,
    name: "harness_active",
    keys: { projectId: 1, active: 1, version: -1 },
  },

  // thread merge lookups (R9)
  {
    collection: Collections.messages,
    name: "messages_thread",
    keys: { projectId: 1, threadKey: 1, ts: 1 },
  },
];

/**
 * Atlas Vector Search index for dead-end retrieval (R12).
 * Filtered by projectId + outcome so a warning never leaks across projects (R14).
 */
export const VECTOR_INDEXES: SearchIndexDef[] = [
  {
    collection: Collections.attempts,
    name: env.ATLAS_VECTOR_INDEX ?? "attempts_vector",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: EMBEDDING_DIMS,
          similarity: "cosine",
        },
        { type: "filter", path: "projectId" },
        { type: "filter", path: "outcome" },
        { type: "filter", path: "status" },
      ],
    },
  },
  {
    collection: Collections.decisions,
    name: "decisions_vector",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: EMBEDDING_DIMS,
          similarity: "cosine",
        },
        { type: "filter", path: "projectId" },
        { type: "filter", path: "status" },
      ],
    },
  },
];

/** Atlas Search (text/hybrid) indexes for lexical recall (R12, hybridWeight). */
export const TEXT_INDEXES: SearchIndexDef[] = [
  {
    collection: Collections.attempts,
    name: env.ATLAS_TEXT_INDEX ?? "attempts_text",
    type: "search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          projectId: { type: "token" },
          goal: { type: "string" },
          approach: { type: "string" },
          alternative: { type: "string" },
          outcome: { type: "token" },
          status: { type: "token" },
        },
      },
    },
  },
  {
    collection: Collections.decisions,
    name: "decisions_text",
    type: "search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          projectId: { type: "token" },
          title: { type: "string" },
          rationale: { type: "string" },
          status: { type: "token" },
        },
      },
    },
  },
];
