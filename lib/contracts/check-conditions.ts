import { getFixture } from '../fixtures'
import type { ConditionTransition } from '../types'

// Owner: Capture lane (f-a-07). PLACEHOLDER: returns the fixture's `unblocks`
// edges for the decision. f-a-07 replaces the body with retrieval plus a
// strong-model check; the signature stays the same.
export async function checkConditions(projectId: string, decisionId: string): Promise<ConditionTransition[]> {
  const fixture = getFixture(projectId)
  if (!fixture) return []
  return fixture.edges
    .filter((edge) => edge.kind === 'unblocks' && edge.from.kind === 'decision' && edge.from.id === decisionId)
    .map((edge) => ({
      attemptId: edge.to.id,
      decisionId,
      explanation: edge.explanation ?? 'This decision may satisfy a condition of the attempt.',
    }))
}
