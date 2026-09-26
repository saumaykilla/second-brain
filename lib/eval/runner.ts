// Eval runner (f-b-06, R21).
//
// Runs the 40-case eval set through the real serve-lane contracts and computes:
//   - dead-end precision & recall (over the 15 dead-end cases incl. tricky ones)
//   - decision-recall citation accuracy (15 cases)
//   - condition-met accuracy / staleness (10 cases)
//   - average hours saved per accepted warning
// The `overall` score gates reflection promotion (R22).

import { checkConditions, checkDeadEnds } from '../contracts'
import { answerQuestion } from '../answer'
import { EVAL_SET, EVAL_COUNTS, type EvalCase } from './eval-set'
import { getFixture } from '../fixtures'
import type { HarnessScores } from '../types'

export interface EvalReport extends HarnessScores {
  counts: typeof EVAL_COUNTS
  conditionAccuracy: number
  avgHoursSaved: number
  failures: string[]
}

function setEq(a: string[], b: string[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

export async function runEval(projectId: string): Promise<EvalReport> {
  const failures: string[] = []

  // --- Dead-end precision & recall ---
  let tp = 0
  let fp = 0
  let fn = 0
  let hoursSum = 0
  let acceptedWarnings = 0

  const deadEndCases = EVAL_SET.filter((c) => c.type === 'dead_end')
  for (const c of deadEndCases) {
    const matches = await checkDeadEnds(projectId, c.input)
    const gotIds = matches.map((m) => m.attempt._id)
    const expected = c.expectedAttemptIds ?? []

    if (expected.length === 0) {
      // Tricky non-match: any warning is a false positive (R14).
      if (gotIds.length > 0) {
        fp += gotIds.length
        failures.push(`${c.id}: warned on a non-match (${gotIds.join(', ')})`)
      }
    } else {
      const hit = expected.some((id) => gotIds.includes(id))
      if (hit) tp += 1
      else {
        fn += 1
        failures.push(`${c.id}: missed expected ${expected.join(', ')}`)
      }
      // Count extra matches beyond the expected as false positives.
      const extra = gotIds.filter((id) => !expected.includes(id))
      fp += extra.length
    }

    for (const m of matches) {
      hoursSum += m.hoursSaved
      acceptedWarnings += 1
    }
  }

  const deadEndPrecision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const deadEndRecall = tp + fn === 0 ? 1 : tp / (tp + fn)

  // --- Decision recall / citation accuracy ---
  let citeHits = 0
  const recallCases = EVAL_SET.filter((c) => c.type === 'decision_recall')
  for (const c of recallCases) {
    const answer = await answerQuestion(projectId, c.input)
    const citedIds = answer.citations.map((cit) => cit.id)
    const expected = c.expectedDecisionIds ?? []
    // A superseded expected decision must NOT be the cited current one (R17).
    const ok = expected.some((id) => citedIds.includes(id)) && !citesSupersededAsCurrent(answer.citations)
    if (ok) citeHits += 1
    else failures.push(`${c.id}: expected citation ${expected.join(', ')}, got ${citedIds.join(', ')}`)
  }
  const citationAccuracy = recallCases.length === 0 ? 1 : citeHits / recallCases.length

  // --- Condition-met accuracy ---
  let condHits = 0
  const condCases = EVAL_SET.filter((c) => c.type === 'condition_met')
  for (const c of condCases) {
    const transitions = await checkConditions(projectId, c.decisionId!)
    const got = transitions.map((t) => t.attemptId)
    if (setEq(got, c.expectedReopens ?? [])) condHits += 1
    else failures.push(`${c.id}: expected reopen ${(c.expectedReopens ?? []).join(', ')}, got ${got.join(', ')}`)
  }
  const conditionAccuracy = condCases.length === 0 ? 1 : condHits / condCases.length

  // --- Staleness: fraction of active dead ends whose conditions are already met
  // but still marked active (should be low). ---
  const fixture = getFixture(projectId)
  const activeDeadEnds = (fixture?.attempts ?? []).filter((a) => a.status === 'active' && a.outcome !== 'partially_worked')
  const stale = activeDeadEnds.filter((a) => a.conditions.some((cond) => cond.met)).length
  const staleness = activeDeadEnds.length === 0 ? 0 : stale / activeDeadEnds.length

  const avgHoursSaved = acceptedWarnings === 0 ? 0 : hoursSum / acceptedWarnings

  const overall = round(
    0.35 * deadEndPrecision + 0.3 * deadEndRecall + 0.2 * citationAccuracy + 0.15 * conditionAccuracy,
  )

  return {
    deadEndPrecision: round(deadEndPrecision),
    deadEndRecall: round(deadEndRecall),
    citationAccuracy: round(citationAccuracy),
    staleness: round(staleness),
    overall,
    conditionAccuracy: round(conditionAccuracy),
    avgHoursSaved: round(avgHoursSaved),
    counts: EVAL_COUNTS,
    failures,
  }
}

function citesSupersededAsCurrent(citations: Array<{ status: string; supersededBy?: string }>): boolean {
  // A citation marked 'active'/'current' must not itself be superseded.
  return citations.some((c) => c.status !== 'superseded' && c.supersededBy != null)
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export { EVAL_SET, EVAL_COUNTS }
export type { EvalCase }
