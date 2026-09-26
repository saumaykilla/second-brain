/**
 * The capture & extraction pipeline (A1 + A2).
 *
 * A small LangGraph-style state machine. Nodes run in order and each one writes a
 * checkpoint (R34, A2). The node set:
 *
 *   classify        (A1) — label the message using the active harness prompt (R7)
 *   extract         (A1) — structure an attempt/decision using the active prompt (R8)
 *   merge_attempt   (A2) — merge an attempt_result into an open attempt in the
 *                          same thread / by the same author within N days (R9)
 *   embed_and_store (A2) — embed the record and persist it (R12)
 *   link            (A2) — create edges (caused_by / alternative_to / blocked_by) (R6)
 *
 * The graph is deliberately framework-light so it type-checks and runs offline.
 * Swapping in the real @langchain/langgraph StateGraph keeps the same node
 * functions; only the runner + MongoDBSaver wiring changes.
 */

import type {
  Attempt,
  Decision,
  Edge,
  HarnessConfig,
  IngestResult,
  Message,
  MessageKind,
  MessageSource,
} from "../types.js";
import type { ModelProvider } from "./providers.js";
import type { BrainStore } from "./store.js";
import type { Checkpointer } from "./checkpointer.js";

/** How long after an attempt_start an attempt_result can still merge (R9). */
const MERGE_WINDOW_DAYS = 3;

export interface PipelineDeps {
  provider: ModelProvider;
  store: BrainStore;
  checkpointer: Checkpointer;
  harness: HarnessConfig;
}

export interface PipelineInput {
  projectId: string;
  source: MessageSource;
  author: string;
  text: string;
  ts: string;
  threadKey?: string;
  meta?: Record<string, unknown>;
}

/** Mutable state threaded through the nodes; each node returns a trace line. */
interface GraphState {
  input: PipelineInput;
  message?: Message;
  kind?: MessageKind;
  extracted?: { kind: "attempt" | "decision"; attempt?: Partial<Attempt>; decision?: Partial<Decision> } | null;
  attempt?: Attempt;
  decision?: Decision;
  merged: boolean;
  trace: string[];
}

function iso(): string {
  return new Date().toISOString();
}

// --- Nodes ---------------------------------------------------------------

async function classifyNode(state: GraphState, deps: PipelineDeps): Promise<void> {
  const { store, provider, harness } = deps;
  const msg: Message = {
    projectId: state.input.projectId,
    source: state.input.source,
    author: state.input.author,
    text: state.input.text,
    ts: state.input.ts,
    threadKey: state.input.threadKey,
    kind: null,
    meta: state.input.meta,
    createdAt: iso(),
    updatedAt: iso(),
  };
  const kind = await provider.classify(harness.prompts.classify, state.input.text);
  msg.kind = kind;
  state.message = await store.insertMessage(msg);
  state.kind = kind;
  state.trace.push(`classify -> ${kind}`);
}

async function extractNode(state: GraphState, deps: PipelineDeps): Promise<void> {
  const kind = state.kind!;
  // Noise / question / intent do not create records (R10). Intent flows to the
  // dead-end check elsewhere (A3), not to extraction.
  if (kind !== "decision" && kind !== "attempt_start" && kind !== "attempt_result") {
    state.extracted = null;
    state.trace.push(`extract -> skipped (${kind})`);
    return;
  }
  state.extracted = await deps.provider.extract(
    deps.harness.prompts.extract,
    state.input.text,
    kind
  );
  state.trace.push(
    `extract -> ${state.extracted ? state.extracted.kind : "none"}`
  );
}

async function mergeAttemptNode(state: GraphState, deps: PipelineDeps): Promise<void> {
  if (!state.extracted || state.extracted.kind !== "attempt") {
    state.trace.push("merge_attempt -> n/a");
    return;
  }
  const { store } = deps;
  const { input, message } = state;

  // Try to merge into an open attempt (R9): same thread first, then same author.
  let target =
    (await store.findOpenAttemptByThread(input.projectId, input.threadKey)) ??
    (await store.findOpenAttemptByAuthor(
      input.projectId,
      input.author,
      MERGE_WINDOW_DAYS,
      input.ts
    ));

  const part = state.extracted.attempt!;

  if (target) {
    // Merge the result into the existing attempt rather than duplicating (R9).
    const merged: Attempt = {
      ...target,
      outcome: part.outcome ?? target.outcome,
      approach: part.approach ?? target.approach,
      blockers: [...target.blockers, ...(part.blockers ?? [])],
      hoursSpent: target.hoursSpent + (part.hoursSpent ?? 0),
      authors: Array.from(new Set([...target.authors, input.author])),
      sourceMessageIds: [...target.sourceMessageIds, message!._id!],
      updatedAt: iso(),
    };
    state.attempt = merged;
    state.merged = true;
    state.trace.push(`merge_attempt -> merged into ${target._id}`);
  } else {
    // New attempt.
    state.attempt = {
      projectId: input.projectId,
      goal: part.goal ?? input.text.slice(0, 100),
      approach: part.approach ?? input.text,
      outcome: part.outcome ?? "failed",
      status: "active",
      blockers: part.blockers ?? [],
      evidenceIds: [],
      conditions: part.conditions ?? [],
      hoursSpent: part.hoursSpent ?? 0,
      alternative: part.alternative,
      authors: [input.author],
      sourceMessageIds: [message!._id!],
      entityIds: [],
      createdAt: iso(),
      updatedAt: iso(),
    };
    state.merged = false;
    state.trace.push("merge_attempt -> new attempt");
  }
}

async function embedAndStoreNode(state: GraphState, deps: PipelineDeps): Promise<void> {
  const { store, provider } = deps;

  if (state.extracted?.kind === "attempt" && state.attempt) {
    const text = `${state.attempt.goal} ${state.attempt.approach}`;
    state.attempt.embedding = await provider.embed(text);
    state.attempt = await store.upsertAttempt(state.attempt);
    state.trace.push("embed_and_store -> attempt");
  } else if (state.extracted?.kind === "decision") {
    const part = state.extracted.decision!;
    const decision: Decision = {
      projectId: state.input.projectId,
      title: part.title ?? state.input.text.slice(0, 80),
      rationale: part.rationale ?? state.input.text,
      status: part.status ?? "active",
      authors: [state.input.author],
      sourceMessageIds: [state.message!._id!],
      entityIds: [],
      evidenceIds: [],
      createdAt: iso(),
      updatedAt: iso(),
    };
    decision.embedding = await provider.embed(`${decision.title} ${decision.rationale}`);
    state.decision = await store.insertDecision(decision);
    state.trace.push("embed_and_store -> decision");
  } else {
    state.trace.push("embed_and_store -> n/a");
  }
}

async function linkNode(state: GraphState, deps: PipelineDeps): Promise<void> {
  const { store } = deps;
  const edges: Edge[] = [];
  const base = { projectId: state.input.projectId, createdAt: iso(), updatedAt: iso() };

  if (state.attempt?._id && !state.merged) {
    // A failed attempt is blocked_by its own blocker(s) (R6).
    if (state.attempt.blockers.length > 0) {
      edges.push({
        ...base,
        type: "blocked_by",
        from: state.attempt._id,
        fromType: "attempt",
        to: state.attempt._id,
        toType: "attempt",
        note: state.attempt.blockers[0].type,
      });
    }
  }
  for (const e of edges) await store.insertEdge(e);
  state.trace.push(`link -> ${edges.length} edge(s)`);
}

// --- Runner --------------------------------------------------------------

const NODES: Array<[string, (s: GraphState, d: PipelineDeps) => Promise<void>]> = [
  ["classify", classifyNode],
  ["extract", extractNode],
  ["merge_attempt", mergeAttemptNode],
  ["embed_and_store", embedAndStoreNode],
  ["link", linkNode],
];

/**
 * Run one message through the pipeline. Writes a checkpoint after every node so
 * a crashed run can resume (A2). Returns the IngestResult contract from S1.
 */
export async function runPipeline(
  input: PipelineInput,
  deps: PipelineDeps
): Promise<IngestResult & { trace: string[] }> {
  const threadId = `${input.projectId}:${input.threadKey ?? input.ts}:${input.author}`;
  const state: GraphState = { input, merged: false, trace: [] };

  for (const [name, fn] of NODES) {
    await fn(state, deps);
    await deps.checkpointer.put(threadId, name, {
      kind: state.kind,
      attemptId: state.attempt?._id,
      decisionId: state.decision?._id,
      merged: state.merged,
    });
  }

  return {
    message: state.message!,
    kind: state.kind!,
    attempt: state.attempt,
    decision: state.decision,
    merged: state.merged,
    trace: state.trace,
  };
}
