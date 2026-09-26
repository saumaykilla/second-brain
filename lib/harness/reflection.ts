// Reflection and promotion (f-b-07, R22).
//
// Reflection proposes ONE harness change from failing eval cases and negative
// feedback, evaluates the candidate, and promotes it ONLY if the overall score
// beats the parent AND dead-end precision does not drop. Otherwise the candidate
// is rejected with a recorded reason (R22, AE5).
//
// The eval score is supplied by a scorer function so tests can force a candidate
// that lowers precision (to prove it is rejected) or one that improves the
// parent (to prove it is promoted), without depending on live models.

import type { HarnessConfig, HarnessScores } from '../types'

export interface Proposal {
  change: string
  mutate: (parent: HarnessConfig) => HarnessConfig
}

export interface ReflectionInput {
  parent: HarnessConfig
  parentScores: HarnessScores
  proposal: Proposal
  /** Scores the candidate config (runs the eval set). */
  scoreCandidate: (candidate: HarnessConfig) => Promise<HarnessScores>
}

export interface ReflectionResult {
  promoted: boolean
  candidate: HarnessConfig
  candidateScores: HarnessScores
  reason: string
}

/**
 * Decide whether to promote a candidate. Promotion rule (R22):
 *   overall strictly improves AND deadEndPrecision does not drop.
 */
export async function reflectAndPromote(input: ReflectionInput): Promise<ReflectionResult> {
  const { parent, parentScores, proposal, scoreCandidate } = input

  const candidateBase = proposal.mutate(parent)
  const candidate: HarnessConfig = {
    ...candidateBase,
    version: parent.version + 1,
    parentVersion: parent.version,
    active: false,
    change: proposal.change,
    createdAt: new Date().toISOString(),
  }

  const candidateScores = await scoreCandidate(candidate)

  const improved = candidateScores.overall > parentScores.overall
  const precisionHeld = candidateScores.deadEndPrecision >= parentScores.deadEndPrecision

  if (improved && precisionHeld) {
    return {
      promoted: true,
      candidate: { ...candidate, active: true, scores: candidateScores },
      candidateScores,
      reason: `Promoted: overall ${parentScores.overall} -> ${candidateScores.overall}, precision held (${candidateScores.deadEndPrecision} >= ${parentScores.deadEndPrecision}).`,
    }
  }

  const why = !improved
    ? `overall did not improve (${candidateScores.overall} <= ${parentScores.overall})`
    : `dead-end precision dropped (${candidateScores.deadEndPrecision} < ${parentScores.deadEndPrecision})`
  return {
    promoted: false,
    candidate: { ...candidate, active: false, rejectedReason: why, scores: candidateScores },
    candidateScores,
    reason: `Rejected: ${why}.`,
  }
}

/**
 * Build a proposal from failing cases / negative feedback (R22). A single,
 * conservative change: if precision is the weak spot, raise the retrieval
 * minScore (fewer, higher-quality candidates); if recall is weak, lower it.
 */
export function proposeFromSignals(scores: HarnessScores, negativeFeedbackCount: number): Proposal {
  const precisionWeak = scores.deadEndPrecision < scores.deadEndRecall || negativeFeedbackCount > 0
  if (precisionWeak) {
    return {
      change: 'Raise retrieval.minScore by 0.03 to cut false positives.',
      mutate: (parent) => ({
        ...parent,
        retrieval: { ...parent.retrieval, minScore: round(parent.retrieval.minScore + 0.03) },
      }),
    }
  }
  return {
    change: 'Lower retrieval.minScore by 0.03 to improve recall.',
    mutate: (parent) => ({
      ...parent,
      retrieval: { ...parent.retrieval, minScore: round(Math.max(0, parent.retrieval.minScore - 0.03)) },
    }),
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
