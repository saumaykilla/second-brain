/**
 * ProjectBrain — shared record shapes (S1).
 *
 * The agreed contract between Person 1 (ingestion) and Person 2 (retrieval/judge).
 * These are the shapes of documents in MongoDB Atlas (the system of record, R34) and
 * the shapes returned by the shared functions in `src/shared/*` (S4).
 *
 * Field definitions trace directly to the product contract in
 * docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md (R1–R6, R19).
 *
 * Zero runtime dependencies on purpose: this file must type-check before any
 * `npm install`, so both partners can import it immediately.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Stringified ObjectId. Kept as `string` so this file has no mongodb dependency. */
export type Id = string;

/** ISO-8601 timestamp string, e.g. "2026-08-14T09:30:00.000Z". */
export type ISODateString = string;

/** An embedding vector. Dimensionality set by OPENAI_EMBEDDING_DIMS (default 1536). */
export type Embedding = number[];

/** Every project-scoped document carries these. Enforces tenant isolation (R1). */
export interface ProjectScoped {
  /** The project this record belongs to. All queries MUST filter on this (R1, R14 isolation). */
  projectId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Collection names (single source of truth for db access)
// ---------------------------------------------------------------------------

export const Collections = {
  messages: "messages",
  attempts: "attempts",
  decisions: "decisions",
  entities: "entities",
  edges: "edges",
  evidence: "evidence",
  warnings: "warnings",
  feedback: "feedback",
  evals: "evals",
  harnessConfigs: "harness_configs",
  /** LangGraph MongoDBSaver checkpoints (R34, A2). */
  checkpoints: "checkpoints",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];

// ---------------------------------------------------------------------------
// Messages & classification (R7, R10)
// ---------------------------------------------------------------------------

export type MessageSource = "slack" | "web" | "github" | "ci" | "manual";

/** Classification labels a message can receive (R7). */
export type MessageKind =
  | "decision"
  | "attempt_start"
  | "attempt_result"
  | "intent"
  | "question"
  | "noise";

export interface Message extends ProjectScoped {
  _id?: Id;
  source: MessageSource;
  /** Thread grouping key (Slack thread_ts, PR number, etc.). Used to merge attempts (R9). */
  threadKey?: string;
  author: string;
  text: string;
  /** When the message was actually said/created upstream (not ingestion time). */
  ts: ISODateString;
  /** Classification result; null until the pipeline classifies it. */
  kind: MessageKind | null;
  /** Free-form provenance (channel id, permalink, PR url, commit sha, ...). */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Blockers & evidence (R3, R4)
// ---------------------------------------------------------------------------

/** Typed reason an attempt failed (R3). */
export type BlockerType =
  | "technical_limit"
  | "cost"
  | "performance"
  | "library_bug"
  | "licensing"
  | "org_constraint"
  | "time";

export interface Blocker {
  type: BlockerType;
  /** Human-readable detail of the specific limit hit. */
  detail: string;
  /** Ids of evidence records supporting this blocker (R4). */
  evidenceIds?: Id[];
}

/** Kinds of evidence an attempt/decision can cite (R4). */
export type EvidenceKind =
  | "log_excerpt"
  | "benchmark"
  | "pr"
  | "commit"
  | "slack_thread"
  | "file";

export interface Evidence extends ProjectScoped {
  _id?: Id;
  kind: EvidenceKind;
  /** Short label shown in the UI, e.g. "socket disconnect log". */
  title: string;
  /** For log/benchmark: inline excerpt. For pr/commit/slack/file: canonical url. */
  content?: string;
  url?: string;
  /** For `file`: object-storage key so the stored file can be opened (R4, f-aws-02). */
  storageKey?: string;
  /** The attempt or decision this evidence supports. */
  subjectId?: Id;
  subjectType?: "attempt" | "decision";
}

// ---------------------------------------------------------------------------
// Attempts (R2) — the heart of Dead-End Memory
// ---------------------------------------------------------------------------

/** How an attempt ended (R2). */
export type AttemptOutcome = "failed" | "partially_worked" | "abandoned";

/**
 * Lifecycle status (R2, R18).
 * - active:      a standing dead end
 * - revisitable: a later decision met its conditions; the blocker may no longer apply
 * - resolved:    superseded/closed
 */
export type AttemptStatus = "active" | "revisitable" | "resolved";

/**
 * A condition under which the dead end could be reconsidered (R18, R33).
 * `met` flips to true when checkConditions() finds a satisfying decision.
 */
export interface Condition {
  /** e.g. "realtime service runs on a persistent (non-serverless) runtime". */
  text: string;
  met: boolean;
  /** The decision that satisfied this condition, once met. */
  metByDecisionId?: Id;
  metAt?: ISODateString;
}

export interface Attempt extends ProjectScoped {
  _id?: Id;
  goal: string;
  approach: string;
  outcome: AttemptOutcome;
  status: AttemptStatus;
  blockers: Blocker[];
  /** Evidence record ids (R4). */
  evidenceIds: Id[];
  /** Conditions under which this dead end may be revisited (R18). */
  conditions: Condition[];
  /** Engineer-hours sunk into the attempt; drives "hours saved" (R13, R21). */
  hoursSpent: number;
  /** What the team did instead — the alternative surfaced in a warning (R13). */
  alternative?: string;
  authors: string[];
  /** Message ids that were merged into this attempt (R9). */
  sourceMessageIds: Id[];
  /** Entity ids mentioned (libraries, services, ...). */
  entityIds: Id[];
  /** Embedding of the goal+approach for vector search (R12). */
  embedding?: Embedding;
}

// ---------------------------------------------------------------------------
// Decisions (R5)
// ---------------------------------------------------------------------------

export type DecisionStatus = "active" | "superseded";

export interface Decision extends ProjectScoped {
  _id?: Id;
  title: string;
  rationale: string;
  status: DecisionStatus;
  /** The decision id that superseded this one, if any (R5, R17). */
  supersededById?: Id;
  authors: string[];
  sourceMessageIds: Id[];
  entityIds: Id[];
  evidenceIds: Id[];
  embedding?: Embedding;
}

// ---------------------------------------------------------------------------
// Entities & edges (R6)
// ---------------------------------------------------------------------------

export type EntityType =
  | "library"
  | "service"
  | "product"
  | "person"
  | "concept";

export interface Entity extends ProjectScoped {
  _id?: Id;
  name: string;
  type: EntityType;
  aliases?: string[];
}

/** Relationship types the memory graph can express (R6). */
export type EdgeType =
  | "caused_by"
  | "superseded_by"
  | "alternative_to"
  | "blocked_by"
  | "unblocks";

export type EdgeNodeType = "attempt" | "decision" | "entity";

export interface Edge extends ProjectScoped {
  _id?: Id;
  type: EdgeType;
  /** Source node. Indexed as edges.from (S2). */
  from: Id;
  fromType: EdgeNodeType;
  /** Target node. Indexed as edges.to (S2). */
  to: Id;
  toType: EdgeNodeType;
  note?: string;
}

// ---------------------------------------------------------------------------
// Warnings & feedback (R13, R15)
// ---------------------------------------------------------------------------

export interface Warning extends ProjectScoped {
  _id?: Id;
  /** The dead-end attempt this warning is about (R13). */
  attemptId: Id;
  /** The message/intent that triggered the warning. */
  triggerMessageId?: Id;
  triggerText: string;
  confidence: number;
  reason: string;
  /** Snapshot of what was shown (blocker/alternative/hours) so it survives edits. */
  blocker?: Blocker;
  alternative?: string;
  hoursSaved: number;
  /** Where it was posted, e.g. a Slack thread permalink (R29). */
  postedTo?: string;
}

export type FeedbackAction = "helpful" | "not_relevant";

export interface Feedback extends ProjectScoped {
  _id?: Id;
  subjectType: "warning" | "answer";
  subjectId: Id;
  action: FeedbackAction;
  author?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Harness config (R19) — "the harness is data"
// ---------------------------------------------------------------------------

/** Model routing policy (R35): which model each stage uses. */
export interface ModelRouting {
  classifyModel: string;
  extractModel: string;
  judgeModel: string;
  reflectionModel: string;
  embeddingModel: string;
}

/** Retrieval + judge thresholds (R12, R19). */
export interface RetrievalSettings {
  /** number of vector candidates to fetch. */
  k: number;
  /** minimum vector score to keep a candidate. */
  minScore: number;
  /** blend weight between vector and text (0 = text only, 1 = vector only). */
  hybridWeight: number;
  /** confidence cutoff at/above which the judge's match becomes a warning. */
  judgeCutoff: number;
}

export interface HarnessPrompts {
  classify: string;
  extract: string;
  judge: string;
  answer: string;
  reflection: string;
}

export interface HarnessConfig extends ProjectScoped {
  _id?: Id;
  /** Monotonic version number within a project. */
  version: number;
  /** Only one active version per project (R19). */
  active: boolean;
  /** Version this was proposed from (R22). */
  parentVersion?: number;
  prompts: HarnessPrompts;
  retrieval: RetrievalSettings;
  routing: ModelRouting;
  /** Recorded eval score at promotion time (R21, R22). */
  score?: EvalScore;
  /** If a candidate was rejected, why (R22, AE5). */
  rejectedReason?: string;
}

// ---------------------------------------------------------------------------
// Evals (R20, R21)
// ---------------------------------------------------------------------------

export type EvalCaseType = "dead_end" | "decision_recall" | "condition_met";

export interface EvalCase extends ProjectScoped {
  _id?: Id;
  type: EvalCaseType;
  input: string;
  /** Expected attempt/decision ids that should be recalled. */
  expectedIds: Id[];
  /** True for the 5 tricky non-matches among dead-end cases (R20). */
  isTrickyNonMatch?: boolean;
}

export interface EvalScore {
  deadEndPrecision: number;
  deadEndRecall: number;
  citationAccuracy: number;
  stalenessRate: number;
  avgHoursSavedPerAcceptedWarning: number;
}

// ---------------------------------------------------------------------------
// Shared function I/O (S4) — the contract the two partners build against
// ---------------------------------------------------------------------------

/** Input to checkDeadEnds() (R11). */
export interface CheckDeadEndsInput {
  projectId: string;
  /** The intent / pasted plan / question proposing an approach. */
  text: string;
  /** Optional pre-computed embedding; the real impl computes one if absent. */
  embedding?: Embedding;
}

/** A single dead-end match returned by checkDeadEnds() (R12, R13). */
export interface DeadEndMatch {
  attempt: Attempt;
  confidence: number;
  reason: string;
  /** Whether the original blocker still applies given current decisions (R12). */
  blockerStillApplies: boolean;
  evidence: Evidence[];
  hoursSaved: number;
}

export interface CheckDeadEndsResult {
  /** Empty when a genuinely different idea is proposed (R14). */
  matches: DeadEndMatch[];
}

/** Input to checkConditions() (R18). */
export interface CheckConditionsInput {
  projectId: string;
  decision: Decision;
}

/** One dead end that a new decision made revisitable (R18, R33). */
export interface ConditionTransition {
  attemptId: Id;
  fromStatus: AttemptStatus;
  toStatus: AttemptStatus;
  /** The condition text that was satisfied. */
  condition: string;
  /** Which blocker may no longer apply. */
  blocker?: Blocker;
  explanation: string;
}

export interface CheckConditionsResult {
  transitions: ConditionTransition[];
}

/** Input to ingest() (R7, R8, F1). */
export interface IngestInput {
  projectId: string;
  source: MessageSource;
  author: string;
  text: string;
  ts?: ISODateString;
  threadKey?: string;
  meta?: Record<string, unknown>;
}

export interface IngestResult {
  message: Message;
  kind: MessageKind;
  /** Set when extraction produced or updated an attempt (R8, R9). */
  attempt?: Attempt;
  /** Set when extraction produced a decision (R8). */
  decision?: Decision;
  /** True when an existing attempt was merged into rather than created (R9). */
  merged: boolean;
}
