/**
 * Orbit seed fixture data (S3), authored in typed TS so shapes stay valid.
 *
 * The Orbit story (R31–R33):
 *   - 4 dead ends: WebSockets-on-serverless (14h → SSE), Postgres LIKE search
 *     (9h → Atlas Search), a PDF library abandoned for licensing (6h), and a
 *     cheapest-model ticket summary at 61% accuracy.
 *   - 5 decisions incl. the superseded auth chain (sessions → JWT → Better Auth)
 *     and the App Runner decision that makes the WebSockets dead end revisitable.
 *   - 10 edges wiring caused_by / superseded_by / alternative_to / blocked_by / unblocks.
 *
 * This is HAND-WRITTEN fake data with deterministic embeddings so both partners
 * can work offline before the real pipeline seeds Orbit through extraction (R30, f-db-02).
 *
 * NOTE: In the final demo, Orbit is produced by running seed messages through the
 * real capture pipeline (R30). This fixture is the S3 stand-in that unblocks
 * retrieval work (Person 2) while ingestion (Person 1) is being built.
 */

import type {
  Attempt,
  Decision,
  Edge,
  Evidence,
  HarnessConfig,
} from "../types.js";
import { fakeEmbed } from "./embedding.js";

export const PROJECT_ID = "orbit";

const now = "2026-09-26T00:00:00.000Z";
function at(week: number): string {
  // 6 weeks of history ending ~now; week 0 is oldest.
  const base = Date.parse("2026-08-15T09:00:00.000Z");
  return new Date(base + week * 7 * 24 * 3600 * 1000).toISOString();
}

// Stable ids so edges can reference them.
const ID = {
  aWebsockets: "att_websockets_serverless",
  aPgLike: "att_postgres_like_search",
  aPdfLib: "att_pdf_library_licensing",
  aCheapModel: "att_cheap_model_summary",
  dSessions: "dec_auth_sessions",
  dJwt: "dec_auth_jwt",
  dBetterAuth: "dec_auth_better_auth",
  dSse: "dec_realtime_sse",
  dAppRunner: "dec_realtime_app_runner",
  evWsLog: "ev_ws_disconnect_log",
  evPgBench: "ev_pg_like_benchmark",
  evPdfLicense: "ev_pdf_license",
  evModelEval: "ev_model_accuracy",
} as const;

// ---------------------------------------------------------------------------
// Evidence (R4)
// ---------------------------------------------------------------------------
export const evidence: Evidence[] = [
  {
    _id: ID.evWsLog,
    projectId: PROJECT_ID,
    kind: "log_excerpt",
    title: "socket.io disconnect on Lambda freeze",
    content:
      "WebSocket connection dropped after ~30s: Lambda execution environment frozen between invocations; no persistent process to hold the socket.",
    subjectId: ID.aWebsockets,
    subjectType: "attempt",
    createdAt: at(1),
    updatedAt: at(1),
  },
  {
    _id: ID.evPgBench,
    projectId: PROJECT_ID,
    kind: "benchmark",
    title: "Postgres LIKE '%term%' full-scan latency",
    content:
      "ILIKE '%query%' on 120k rows: p95 = 2.4s (seq scan, no trigram index that helped for infix search). Atlas Search prototype p95 = 40ms.",
    subjectId: ID.aPgLike,
    subjectType: "attempt",
    createdAt: at(2),
    updatedAt: at(2),
  },
  {
    _id: ID.evPdfLicense,
    projectId: PROJECT_ID,
    kind: "file",
    title: "PDFKitPro LICENSE.txt",
    content: "Commercial redistribution prohibited without per-seat license.",
    storageKey: "orbit/evidence/pdfkitpro-license.txt",
    subjectId: ID.aPdfLib,
    subjectType: "attempt",
    createdAt: at(3),
    updatedAt: at(3),
  },
  {
    _id: ID.evModelEval,
    projectId: PROJECT_ID,
    kind: "benchmark",
    title: "Ticket-summary accuracy by model",
    content:
      "Cheapest model: 61% factual accuracy on 50 labelled tickets (target 85%). Reviewers rejected summaries as unreliable.",
    subjectId: ID.aCheapModel,
    subjectType: "attempt",
    createdAt: at(4),
    updatedAt: at(4),
  },
];

// ---------------------------------------------------------------------------
// Attempts — the 4 dead ends (R2, R31)
// ---------------------------------------------------------------------------
function withEmbedding<
  T extends {
    goal?: string;
    approach?: string;
    title?: string;
    rationale?: string;
    createdAt?: string;
    updatedAt?: string;
  }
>(doc: T): T & { embedding: number[]; createdAt: string; updatedAt: string } {
  const text = [doc.goal, doc.approach, doc.title, doc.rationale]
    .filter(Boolean)
    .join(" ");
  const created = doc.createdAt ?? now;
  return {
    ...doc,
    embedding: fakeEmbed(text),
    createdAt: created,
    updatedAt: doc.updatedAt ?? created,
  };
}

export const attempts: Attempt[] = [
  withEmbedding({
    _id: ID.aWebsockets,
    projectId: PROJECT_ID,
    goal: "Live updates for the Orbit task board so teammates see changes in real time.",
    approach: "Add a socket.io WebSocket server running on the serverless (Lambda) backend.",
    outcome: "failed",
    status: "active",
    blockers: [
      {
        type: "technical_limit",
        detail:
          "Serverless functions freeze between invocations and cannot hold a long-lived WebSocket connection; sockets drop after ~30s.",
        evidenceIds: [ID.evWsLog],
      },
    ],
    evidenceIds: [ID.evWsLog],
    conditions: [
      {
        text: "The realtime service runs on a persistent (non-serverless) runtime such as a container or App Runner.",
        met: false,
      },
    ],
    hoursSpent: 14,
    alternative: "Server-Sent Events (SSE) for one-way live updates.",
    authors: ["priya"],
    sourceMessageIds: [],
    entityIds: [],
    createdAt: at(1),
  }),
  withEmbedding({
    _id: ID.aPgLike,
    projectId: PROJECT_ID,
    goal: "Fast full-text search across tasks and comments.",
    approach: "Use Postgres LIKE / ILIKE '%term%' queries for infix substring search.",
    outcome: "failed",
    status: "active",
    blockers: [
      {
        type: "performance",
        detail:
          "Infix LIKE '%term%' cannot use a normal index and does a sequential scan; p95 hit 2.4s on 120k rows.",
        evidenceIds: [ID.evPgBench],
      },
    ],
    evidenceIds: [ID.evPgBench],
    conditions: [],
    hoursSpent: 9,
    alternative: "MongoDB Atlas Search full-text index.",
    authors: ["sam"],
    sourceMessageIds: [],
    entityIds: [],
    createdAt: at(2),
  }),
  withEmbedding({
    _id: ID.aPdfLib,
    projectId: PROJECT_ID,
    goal: "Export a task report as a nicely formatted PDF.",
    approach: "Integrate the PDFKitPro library for PDF generation.",
    outcome: "abandoned",
    status: "active",
    blockers: [
      {
        type: "licensing",
        detail:
          "PDFKitPro forbids commercial redistribution without a paid per-seat license; incompatible with our shipping model.",
        evidenceIds: [ID.evPdfLicense],
      },
    ],
    evidenceIds: [ID.evPdfLicense],
    conditions: [
      {
        text: "A budget is approved for a commercial per-seat PDF license, or an MIT/Apache alternative is adopted.",
        met: false,
      },
    ],
    hoursSpent: 6,
    alternative: "Evaluate an open-source (MIT) PDF library or server-side HTML-to-PDF.",
    authors: ["dev"],
    sourceMessageIds: [],
    entityIds: [],
    createdAt: at(3),
  }),
  withEmbedding({
    _id: ID.aCheapModel,
    projectId: PROJECT_ID,
    goal: "Auto-summarize support tickets to speed up triage.",
    approach: "Use the cheapest available LLM to generate ticket summaries.",
    outcome: "failed",
    status: "active",
    blockers: [
      {
        type: "performance",
        detail:
          "Cheapest model reached only 61% factual accuracy (target 85%); reviewers rejected the summaries as unreliable.",
        evidenceIds: [ID.evModelEval],
      },
    ],
    evidenceIds: [ID.evModelEval],
    conditions: [
      {
        text: "A cheap model benchmarks at or above 85% accuracy on the labelled ticket set.",
        met: false,
      },
    ],
    hoursSpent: 7,
    alternative: "Route summaries to a stronger model, or fine-tune a mid-tier model.",
    authors: ["priya"],
    sourceMessageIds: [],
    entityIds: [],
    createdAt: at(4),
  }),
];

// ---------------------------------------------------------------------------
// Decisions — 5 incl. superseded auth chain + App Runner (R5, R32, R33)
// ---------------------------------------------------------------------------
export const decisions: Decision[] = [
  withEmbedding({
    _id: ID.dSessions,
    projectId: PROJECT_ID,
    title: "Use server-side sessions for authentication",
    rationale: "Simplest to ship first; store session in the DB and set a cookie.",
    status: "superseded",
    supersededById: ID.dJwt,
    authors: ["sam"],
    sourceMessageIds: [],
    entityIds: [],
    evidenceIds: [],
    createdAt: at(0),
  }),
  withEmbedding({
    _id: ID.dJwt,
    projectId: PROJECT_ID,
    title: "Switch authentication to stateless JWTs",
    rationale: "Wanted stateless auth to scale horizontally without shared session store.",
    status: "superseded",
    supersededById: ID.dBetterAuth,
    authors: ["priya"],
    sourceMessageIds: [],
    entityIds: [],
    evidenceIds: [],
    createdAt: at(2),
  }),
  withEmbedding({
    _id: ID.dBetterAuth,
    projectId: PROJECT_ID,
    title: "Adopt Better Auth (sessions) as the current auth system",
    rationale:
      "JWT revocation and refresh were error-prone; Better Auth gives managed sessions with revocation out of the box.",
    status: "active",
    authors: ["sam"],
    sourceMessageIds: [],
    entityIds: [],
    evidenceIds: [],
    createdAt: at(4),
  }),
  withEmbedding({
    _id: ID.dSse,
    projectId: PROJECT_ID,
    title: "Use Server-Sent Events for live task-board updates",
    rationale:
      "After WebSockets failed on serverless, SSE gives one-way live updates that work over plain HTTP.",
    status: "active",
    authors: ["priya"],
    sourceMessageIds: [],
    entityIds: [],
    evidenceIds: [],
    createdAt: at(2),
  }),
  withEmbedding({
    _id: ID.dAppRunner,
    projectId: PROJECT_ID,
    title: "Move the realtime service to AWS App Runner",
    rationale:
      "We need a persistent runtime for realtime; App Runner keeps a long-lived container process instead of freezing between invocations.",
    status: "active",
    authors: ["sam"],
    sourceMessageIds: [],
    entityIds: [],
    evidenceIds: [],
    createdAt: at(5),
  }),
];

// ---------------------------------------------------------------------------
// Edges — 10 (R6)
// ---------------------------------------------------------------------------
export const edges: Edge[] = (
  [
    // auth chain supersession (R32, R17)
    { type: "superseded_by", from: ID.dSessions, fromType: "decision", to: ID.dJwt, toType: "decision" },
    { type: "superseded_by", from: ID.dJwt, fromType: "decision", to: ID.dBetterAuth, toType: "decision" },
    // WebSockets dead end wiring (R31, F2)
    { type: "alternative_to", from: ID.dSse, fromType: "decision", to: ID.aWebsockets, toType: "attempt" },
    { type: "caused_by", from: ID.aWebsockets, fromType: "attempt", to: ID.evWsLog, toType: "attempt", note: "serverless freeze" },
    { type: "blocked_by", from: ID.aWebsockets, fromType: "attempt", to: ID.aWebsockets, toType: "attempt", note: "technical_limit: serverless" },
    // App Runner unblocks WebSockets (R33, AE4)
    { type: "unblocks", from: ID.dAppRunner, fromType: "decision", to: ID.aWebsockets, toType: "attempt", note: "persistent runtime satisfies condition" },
    // Postgres LIKE dead end (R31)
    { type: "alternative_to", from: ID.aPgLike, fromType: "attempt", to: ID.aPgLike, toType: "attempt", note: "Atlas Search" },
    { type: "blocked_by", from: ID.aPgLike, fromType: "attempt", to: ID.aPgLike, toType: "attempt", note: "performance: seq scan" },
    // PDF licensing dead end (R31)
    { type: "blocked_by", from: ID.aPdfLib, fromType: "attempt", to: ID.aPdfLib, toType: "attempt", note: "licensing" },
    // cheap-model dead end (R31)
    { type: "blocked_by", from: ID.aCheapModel, fromType: "attempt", to: ID.aCheapModel, toType: "attempt", note: "accuracy 61%" },
  ] as Array<Omit<Edge, "projectId" | "createdAt" | "updatedAt">>
).map((e) => ({
  ...e,
  projectId: PROJECT_ID,
  createdAt: now,
  updatedAt: now,
}));

// ---------------------------------------------------------------------------
// A seed harness config (v1) so getActiveHarness() has something to return (R19)
// ---------------------------------------------------------------------------
export const harnessV1: HarnessConfig = {
  _id: "harness_orbit_v1",
  projectId: PROJECT_ID,
  version: 1,
  active: true,
  prompts: {
    classify:
      "Classify the message as one of: decision, attempt_start, attempt_result, intent, question, noise.",
    extract:
      "Extract a structured attempt or decision with goal, approach, outcome, typed blockers, evidence, conditions, hours, and the alternative chosen.",
    judge:
      "Decide whether the new intent is the SAME approach under the SAME conditions as the candidate dead end. Return match, confidence, reason, and whether the blocker still applies.",
    answer:
      "Answer the project question with citations to attempt and decision ids. Never present a superseded decision as current.",
    reflection:
      "Propose exactly one harness setting change from failed evals and negative feedback.",
  },
  retrieval: {
    k: 20,
    minScore: 0.72,
    hybridWeight: 0.6,
    judgeCutoff: 0.7,
  },
  routing: {
    classifyModel: "openai/gpt-4o-mini",
    extractModel: "gpt-4o-mini",
    judgeModel: "openai/gpt-4o",
    reflectionModel: "openai/gpt-4o",
    embeddingModel: "text-embedding-3-small",
  },
  createdAt: now,
  updatedAt: now,
};

export const orbitFixture = {
  projectId: PROJECT_ID,
  generatedAt: now,
  note: "Hand-written S3 fixture. Embeddings are deterministic offline placeholders, not OpenAI embeddings.",
  evidence,
  attempts,
  decisions,
  edges,
  harnessConfigs: [harnessV1],
};

export type OrbitFixture = typeof orbitFixture;
