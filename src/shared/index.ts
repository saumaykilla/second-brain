/**
 * Shared function placeholders (S4).
 *
 * These return FAKE data drawn from the Orbit fixture so both partners can build
 * against a stable contract before the real implementations exist:
 *   - Person 1 (ingestion) calls checkDeadEnds() to add thread warnings (A3),
 *     and getActiveHarness() for extraction prompts (A1).
 *   - Person 2 (retrieval/judge) replaces checkDeadEnds / checkConditions with
 *     real Atlas + judge logic (f-be-02, f-be-05).
 *
 * The signatures here ARE the contract. Do not change them without agreeing (S1).
 * Every function is intentionally dependency-free and deterministic.
 */

import type {
  CheckConditionsInput,
  CheckConditionsResult,
  CheckDeadEndsInput,
  CheckDeadEndsResult,
  ConditionTransition,
  DeadEndMatch,
  HarnessConfig,
  IngestInput,
  IngestResult,
  Message,
  MessageKind,
} from "../types.js";
import {
  attempts as orbitAttempts,
  decisions as orbitDecisions,
  evidence as orbitEvidence,
  harnessV1,
  PROJECT_ID,
} from "../fixtures/orbit.js";
import { fakeEmbed } from "../fixtures/embedding.js";

/** cosine similarity of two equal-length vectors. */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // fixture embeddings are unit-length, so dot === cosine
}

/**
 * PLACEHOLDER checkDeadEnds() — R11–R14.
 *
 * Fake behavior: cosine-matches the input text against the Orbit dead-end
 * embeddings and returns matches above a threshold. Genuinely different ideas
 * return no matches (R14). The real version does Atlas vector search + a judge.
 */
export async function checkDeadEnds(
  input: CheckDeadEndsInput
): Promise<CheckDeadEndsResult> {
  const THRESHOLD = 0.35;
  const queryVec = input.embedding ?? fakeEmbed(input.text);

  const matches: DeadEndMatch[] = orbitAttempts
    .filter((a) => a.projectId === input.projectId)
    .filter((a) => a.outcome === "failed" || a.outcome === "abandoned")
    .map((attempt) => {
      const confidence = cosine(queryVec, attempt.embedding ?? []);
      return { attempt, confidence };
    })
    .filter((m) => m.confidence >= THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .map(({ attempt, confidence }) => {
      const ev = orbitEvidence.filter((e) =>
        attempt.evidenceIds.includes(e._id ?? "")
      );
      return {
        attempt,
        confidence: Number(confidence.toFixed(3)),
        reason: `[placeholder] lexical match to "${attempt.approach}"`,
        // A dead end is revisitable if any condition is already met.
        blockerStillApplies: !attempt.conditions.some((c) => c.met),
        evidence: ev,
        hoursSaved: attempt.hoursSpent,
      } satisfies DeadEndMatch;
    });

  return { matches };
}

/**
 * PLACEHOLDER checkConditions() — R18, R33.
 *
 * Fake behavior: if a decision's text mentions a persistent runtime / App Runner,
 * flip the WebSockets dead end to revisitable. The real version matches decision
 * embeddings against each attempt's conditions.
 */
export async function checkConditions(
  input: CheckConditionsInput
): Promise<CheckConditionsResult> {
  const transitions: ConditionTransition[] = [];
  const text = `${input.decision.title} ${input.decision.rationale}`.toLowerCase();
  const mentionsPersistentRuntime =
    /(app runner|container|persistent runtime|ecs|fargate|kubernetes)/.test(text);

  if (mentionsPersistentRuntime) {
    const ws = orbitAttempts.find((a) => a._id === "att_websockets_serverless");
    if (ws && ws.status === "active") {
      transitions.push({
        attemptId: ws._id!,
        fromStatus: "active",
        toStatus: "revisitable",
        condition: ws.conditions[0]?.text ?? "",
        blocker: ws.blockers[0],
        explanation:
          "[placeholder] The decision provides a persistent runtime, so the serverless-freeze blocker may no longer apply.",
      });
    }
  }

  return { transitions };
}

/**
 * PLACEHOLDER getActiveHarness() — R19.
 *
 * Returns the seeded v1 harness config for the project. The real version reads
 * the active harness_configs document from Atlas.
 */
export async function getActiveHarness(
  projectId: string = PROJECT_ID
): Promise<HarnessConfig> {
  return { ...harnessV1, projectId };
}

/**
 * PLACEHOLDER ingest() — R7–R10.
 *
 * Fake behavior: keyword-classifies the message and, for attempt/decision kinds,
 * returns a matching Orbit fixture record so downstream code has real shapes to
 * render. The real version runs the LangGraph classify → extract → merge → embed
 * → link pipeline (A1, A2).
 */
export async function ingest(input: IngestInput): Promise<IngestResult> {
  const kind = classifyPlaceholder(input.text);
  const nowIso = input.ts ?? new Date().toISOString();

  const message: Message = {
    projectId: input.projectId,
    source: input.source,
    author: input.author,
    text: input.text,
    ts: nowIso,
    threadKey: input.threadKey,
    kind,
    meta: input.meta,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const result: IngestResult = { message, kind, merged: false };

  if (kind === "attempt_start" || kind === "attempt_result") {
    result.attempt = orbitAttempts.find((a) => a.projectId === input.projectId);
    result.merged = kind === "attempt_result";
  } else if (kind === "decision") {
    result.decision = orbitDecisions.find((d) => d.projectId === input.projectId);
  }

  return result;
}

/** Extremely small keyword classifier so ingest() has a plausible kind (R7). */
function classifyPlaceholder(text: string): MessageKind {
  const t = text.toLowerCase();
  if (/\?$|^(why|what|how|when|who)\b/.test(t)) return "question";
  if (/\b(decided|we'll use|going with|switch to|adopt)\b/.test(t)) return "decision";
  if (/\b(didn't work|failed|gave up|abandoned|dropped|blocked)\b/.test(t))
    return "attempt_result";
  if (/\b(i'll try|going to try|attempt|let me add|spike)\b/.test(t))
    return "attempt_start";
  if (/\b(i'm going to|about to|planning to|thinking of adding)\b/.test(t))
    return "intent";
  if (t.trim().length < 12) return "noise";
  return "intent";
}
