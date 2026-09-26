import { getActiveHarness } from './get-active-harness'
import { judgeDeadEnd } from '../models'
import { retrieveAttempts } from '../retrieval'
import type { DeadEndMatch } from '../types'

// Owner: Recall lane (f-b-01). Real implementation:
//   1. Retrieve candidate failed/abandoned attempts by vector similarity,
//      filtered by project + outcome (R12). Uses Atlas Vector Search when a DB
//      is configured, else an in-memory fixture fallback so it runs offline.
//   2. Ask a strong-model judge whether the plan is the SAME approach under the
//      SAME conditions; a genuinely different idea is not warned even when it
//      shares words or scores high on the vector (R14).
//   3. Return the past attempt, confidence, reason, and hours saved (R13).
// Results never cross projects (R1, R14). Signature is frozen (see docs/README).

export async function checkDeadEnds(projectId: string, text: string): Promise<DeadEndMatch[]> {
  // Unknown projects have no memory to check; return no matches rather than
  // throwing (keeps project isolation graceful, R14).
  let harness
  try {
    harness = await getActiveHarness(projectId)
  } catch {
    return []
  }
  const candidates = await retrieveAttempts(projectId, text, harness)
  if (candidates.length === 0) return []

  const matches: DeadEndMatch[] = []
  for (const { doc: attempt, score } of candidates) {
    // Defense in depth: never let another project's record through (R14).
    if (attempt.projectId !== projectId) continue

    const verdict = await judgeDeadEnd(text, attempt, score, harness)
    if (!verdict.match) continue

    matches.push({
      attempt,
      confidence: verdict.confidence,
      reason: verdict.reason,
      hoursSaved: attempt.hoursSpent,
    })
  }

  return matches.sort((a, b) => b.confidence - a.confidence)
}
