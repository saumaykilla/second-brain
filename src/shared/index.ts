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
} from "../types.js";
import {
  attempts as orbitAttempts,
  evidence as orbitEvidence,
  harnessV1,
  PROJECT_ID,
} from "../fixtures/orbit.js";
import { fakeEmbed } from "../fixtures/embedding.js";
import { ingestMessage } from "../pipeline/index.js";

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
 * ingest() — R7–R10. NOW REAL (A1/A2).
 *
 * Runs the message through the capture pipeline: classify → extract →
 * merge_attempt → embed_and_store → link, with checkpoints (see src/pipeline).
 * Uses offline deps by default so it works with no network; pass Atlas-backed
 * deps in production via ingestMessage(input, { store, checkpointer, provider }).
 */
export async function ingest(input: IngestInput): Promise<IngestResult> {
  // Real implementation (A1/A2): run the capture pipeline. The trace is dropped
  // to keep the IngestResult contract shape unchanged (S1).
  const { message, kind, attempt, decision, merged } = await ingestMessage(input);
  return { message, kind, attempt, decision, merged };
}
