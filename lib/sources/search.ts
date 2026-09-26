// Retrieval over connected sources (f-a-10). Candidates come from the standard
// text index; they are re-ranked by cosine similarity of the stored embedding.
// Everything is filtered by projectId so results never cross projects (R1).

import { isDbConfigured } from '../db'
import { cosineSimilarity, embed, embeddingProvider, localEmbed } from '../models'
import { sourceChunks } from './store'
import type { SourceChunk, SourceProvider } from './types'

export interface SourceHit {
  id: string
  provider: SourceProvider
  sourceId: string
  docId: string
  title: string
  url: string
  text: string
  score: number
}

const TEXT_CANDIDATES = 40
const RECENT_CANDIDATES = 200

type Candidate = SourceChunk & { textScore?: number }

export function rankCandidates(
  candidates: Candidate[],
  query: string,
  queryEmbedding: number[],
  provider: string,
  k: number,
): SourceHit[] {
  const localQuery = localEmbed(query)
  const maxText = Math.max(...candidates.map((c) => c.textScore ?? 0), 0)
  return candidates
    .map((chunk) => {
      const vector =
        chunk.embeddingProvider === provider && chunk.embedding?.length === queryEmbedding.length
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : cosineSimilarity(localQuery, localEmbed(chunk.text))
      const text = maxText > 0 ? (chunk.textScore ?? 0) / maxText : 0
      const score = 0.7 * Math.max(0, vector) + 0.3 * text
      return {
        id: chunk._id,
        provider: chunk.provider,
        sourceId: chunk.sourceId,
        docId: chunk.docId,
        title: chunk.title,
        url: chunk.url,
        text: chunk.text,
        score,
      }
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

export async function searchSources(projectId: string, query: string, k = 6): Promise<SourceHit[]> {
  if (!isDbConfigured() || !query.trim()) return []
  const coll = await sourceChunks()

  let candidates: Candidate[] = await coll
    .find({ projectId, $text: { $search: query } }, { projection: { textScore: { $meta: 'textScore' } } })
    .sort({ textScore: { $meta: 'textScore' } })
    .limit(TEXT_CANDIDATES)
    .toArray()

  if (candidates.length === 0) {
    candidates = await coll.find({ projectId }).sort({ updatedAt: -1 }).limit(RECENT_CANDIDATES).toArray()
  }
  if (candidates.length === 0) return []

  const provider = embeddingProvider()
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embed(query)
  } catch {
    queryEmbedding = localEmbed(query)
  }
  return rankCandidates(candidates, query, queryEmbedding, provider, k)
}
