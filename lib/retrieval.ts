// Retrieval for the serve lane (f-b-01, f-b-03).
//
// Finds candidate attempts/decisions for a query. Uses Atlas Vector Search when
// a DB is configured (R12, R34); otherwise falls back to in-memory cosine over
// the fixture so retrieval works offline and in tests. Everything is filtered by
// projectId so results never cross projects (R1, R14).

import { collection, isDbConfigured } from './db'
import { getFixture } from './fixtures'
import { cosineSimilarity, embed, embeddingProvider, localEmbed } from './models'
import type { Attempt, Decision, DocSource, HarnessConfig, KnowledgeDoc } from './types'

export interface Candidate<T> {
  doc: T
  score: number
}

/**
 * In-memory ranking of stored records when Atlas Vector Search is not
 * available. Uses the stored embedding when it came from the current provider,
 * otherwise a local embedding of the text; the minScore cutoff only applies to
 * provider embeddings, since local scores are on a different scale.
 */
async function rankStored<T extends { embedding?: number[]; embeddingProvider?: string }>(
  docs: T[],
  queryText: string,
  textOf: (doc: T) => string,
  k: number,
  minScore: number,
): Promise<Array<Candidate<T>>> {
  if (docs.length === 0) return []
  const provider = embeddingProvider()
  let query: number[]
  try {
    query = await embed(queryText)
  } catch {
    query = localEmbed(queryText)
  }
  const localQuery = localEmbed(queryText)
  return docs
    .map((doc) => {
      const native = provider !== 'local' && doc.embedding && doc.embeddingProvider === provider
      const score = native ? cosineSimilarity(query, doc.embedding!) : cosineSimilarity(localQuery, localEmbed(textOf(doc)))
      return { doc, score, native }
    })
    .filter((c) => (c.native ? c.score >= minScore : c.score > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ doc, score }) => ({ doc, score }))
}

/** Retrieve failed/abandoned attempts most similar to the query (R12). */
export async function retrieveAttempts(
  projectId: string,
  queryText: string,
  harness: HarnessConfig,
): Promise<Array<Candidate<Attempt>>> {
  const { k, minScore } = harness.retrieval

  if (isDbConfigured()) {
    try {
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
      if (docs.length > 0) {
        return docs
          .filter((d) => d.__score >= minScore)
          .map((d) => ({ doc: d as Attempt, score: d.__score }))
      }
      throw new Error('vector_search_empty')
    } catch {
      // The vector index may not exist yet on this database. Rank the
      // project's own stored attempts in memory instead of using the fixture.
      const stored = (await (await collection('attempts'))
        .find({ projectId, outcome: { $in: ['failed', 'abandoned'] } })
        .limit(500)
        .toArray()) as Array<Attempt & { embeddingProvider?: string }>
      return rankStored(stored, queryText, (a) => `${a.goal} ${a.approach}`, k, minScore)
    }
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
    try {
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
      if (docs.length > 0) {
        return docs.filter((d) => d.__score >= minScore).map((d) => ({ doc: d as Decision, score: d.__score }))
      }
      throw new Error('vector_search_empty')
    } catch {
      const stored = (await (await collection('decisions')).find({ projectId }).limit(500).toArray()) as Array<
        Decision & { embeddingProvider?: string }
      >
      return rankStored(stored, queryText, (d) => `${d.title} ${d.rationale}`, k, minScore)
    }
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

export interface RetrieveDocsOptions {
  /** Restrict to one or more sources (notion / slack / github). */
  sources?: DocSource[]
  /** Override how many to return (defaults to the harness k). */
  limit?: number
}

/**
 * Retrieve knowledge documents (Notion / Slack / GitHub / seeded) most similar
 * to the query. This is what makes Ask and knowledge search span the whole
 * project brain, not just attempts and decisions. Uses Atlas Vector Search when
 * a DB is configured, else an in-memory cosine fallback over any fixture docs.
 */
export async function retrieveDocuments(
  projectId: string,
  queryText: string,
  harness: HarnessConfig,
  options: RetrieveDocsOptions = {},
): Promise<Array<Candidate<KnowledgeDoc>>> {
  const { k, minScore } = harness.retrieval
  const limit = options.limit ?? k

  if (isDbConfigured()) {
    const queryVector = await embed(queryText, harness)
    const docs = await collection('documents')
    const filter: Record<string, unknown> = { projectId }
    if (options.sources?.length) filter.source = { $in: options.sources }
    const cursor = docs.aggregate<KnowledgeDoc & { __score: number }>([
      {
        $vectorSearch: {
          index: 'documents_vector',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(100, limit * 10),
          limit,
          filter,
        },
      },
      { $addFields: { __score: { $meta: 'vectorSearchScore' } } },
    ])
    const found = await cursor.toArray()
    return found
      .filter((d) => d.__score >= minScore)
      .map((d) => ({ doc: d as KnowledgeDoc, score: d.__score }))
  }

  // Fixture fallback: some fixtures may seed a `documents` array (optional).
  const fixture = getFixture(projectId) as { documents?: KnowledgeDoc[] } | undefined
  const seeded = fixture?.documents ?? []
  if (seeded.length === 0) return []
  const q = localEmbed(queryText)
  return seeded
    .filter((d) => d.projectId === projectId && (!options.sources?.length || options.sources.includes(d.source)))
    .map((d) => ({ doc: d, score: cosineSimilarity(q, d.embedding ?? localEmbed(`${d.title} ${d.text}`)) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}
