import { getFixture } from '../fixtures'
import type { DeadEndMatch } from '../types'

// Owner: Recall lane (f-b-01). PLACEHOLDER: keyword overlap against fixture
// dead ends. f-b-01 replaces the body with vector search plus a judge; the
// signature stays the same.

const STOP_WORDS = new Set(
  'a an and the to of for on in with so we our is it be get gets add use using from that this all everyone team'.split(' '),
)

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9.]+/)
      .map((word) => word.replace(/^\.+|\.+$/g, '').replace(/s$/, ''))
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )
}

const MIN_OVERLAP = 3

export async function checkDeadEnds(projectId: string, text: string): Promise<DeadEndMatch[]> {
  const fixture = getFixture(projectId)
  if (!fixture) return []
  const planTokens = tokenize(text)

  return fixture.attempts
    .filter((attempt) => attempt.projectId === projectId && attempt.outcome !== 'partially_worked')
    .map((attempt) => {
      const attemptTokens = tokenize(`${attempt.goal} ${attempt.approach}`)
      const shared = [...planTokens].filter((token) => attemptTokens.has(token))
      return { attempt, shared }
    })
    .filter(({ shared }) => shared.length >= MIN_OVERLAP)
    .map(({ attempt, shared }) => ({
      attempt,
      confidence: Math.min(0.95, 0.6 + shared.length * 0.08),
      reason: `Shares ${shared.join(', ')} with a past ${attempt.outcome} attempt.`,
      hoursSaved: attempt.hoursSpent,
    }))
    .sort((a, b) => b.confidence - a.confidence)
}
