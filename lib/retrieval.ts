// Retrieval for the serve lane (f-b-01, f-b-03).
//
// Finds candidate attempts/decisions for a query. Uses Atlas Vector Search when
// a DB is configured (R12, R34); otherwise falls back to in-memory cosine over
// the fixture so retrieval works offline and in tests. Everything is filtered by
// projectId so results never cross projects (R1, R14).

import { collection, isDbConfigured } from './db'
import { getFixture } from './fixtures'
import { cosineSimilarity, embed, localEmbed } from './models'
import type { Attempt, Decision, HarnessConfig } from './types'

export interface Candidate<T> {
  doc: T
  score: number
}

/** Retrieve failed/abandoned attempts most similar to the query (R12). */
export async function retrieveAttempts(
  projectId: string,
  queryText: string,
  harness: HarnessConfig,
): Promise<Array<Candidate<Attempt>>> {
  const { k, minScore } = harness.retrieval

  if (isDbConfigured()) {
    const queryVector = await embed(queryText, harness)
    const attempts = await collection('attempts')
    const cursor = attempts.aggregate<Attempt & { __score: number }>([
      {
        $vectorSearch: {
          index: 'attempts_vector',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(50, k * 10),
          limit: k,
          filter: { projectId, outcome: { $in: ['failed', 'abandoned'] } },
        },
      },
      { $addFields: { __score: { $meta: 'vectorSearchScore' } } },
    ])
    const docs = await cursor.toArray()
    return docs
      .filter((d) => d.__score >= minScore)
      .map((d) => ({ doc: d as Attempt, score: d.__score }))
  }

  // Fixture fallback: embed locally and cosine-rank.
  const fixture = getFixture(projectId)
  if (!fixture) return []
  const q = localEmbed(queryText)
  return fixture.attempts
    .filter((a) => a.projectId === projectId && a.outcome !== 'partially_worked')
    .map((a) => ({
      doc: a,
      score: cosineSimilarity(q, a.embedding ?? localEmbed(`${a.goal} ${a.approach}`)),
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k)
}

/** Retrieve decisions most similar to the query, for cited answers (f-b-03). */
export async function retrieveDecisions(
  projectId: string,
  queryText: string,
  harness: HarnessConfig,
): Promise<Array<Candidate<Decision>>> {
  const { k, minScore } = harness.retrieval

  if (isDbConfigured()) {
    const queryVector = await embed(queryText, harness)
    const decisions = await collection('decisions')
    const cursor = decisions.aggregate<Decision & { __score: number }>([
      {
        $vectorSearch: {
          index: 'decisions_vector',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(50, k * 10),
          limit: k,
          filter: { projectId },
        },
      },
      { $addFields: { __score: { $meta: 'vectorSearchScore' } } },
    ])
    const docs = await cursor.toArray()
    return docs.filter((d) => d.__score >= minScore).map((d) => ({ doc: d as Decision, score: d.__score }))
  }

  const fixture = getFixture(projectId)
  if (!fixture) return []
  const q = localEmbed(queryText)
  return fixture.decisions
    .filter((d) => d.projectId === projectId)
    .map((d) => ({
      doc: d,
      score: cosineSimilarity(q, d.embedding ?? localEmbed(`${d.title} ${d.rationale}`)),
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k)
}
