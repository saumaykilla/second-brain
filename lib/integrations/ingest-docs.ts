// Shared knowledge ingestion (Notion / Slack / GitHub).
//
// Every integration produces raw items, converts them to KnowledgeDoc records,
// embeds the text, and upserts them into the `documents` collection in Atlas.
// This module holds the shared embed + upsert step so each integration only has
// to fetch and map its own data.

import { collection, isDbConfigured } from '../db'
import { embed } from '../models'
import { getActiveHarness } from '../contracts/get-active-harness'
import type { KnowledgeDoc } from '../types'

/** A document without the derived/ingest fields — what an integration produces. */
export type RawDoc = Omit<KnowledgeDoc, 'embedding' | 'ingestedAt'>

export interface IngestReport {
  source: string
  fetched: number
  embedded: number
  upserted: number
  skipped: number
  errors: string[]
}

/**
 * Embed and upsert a batch of documents into Atlas. Idempotent on
 * (projectId, source, sourceId) so re-running an ingest updates in place.
 * Requires a database + OpenAI key; throws a clear error otherwise.
 */
export async function ingestDocuments(projectId: string, raw: RawDoc[]): Promise<IngestReport> {
  const report: IngestReport = {
    source: raw[0]?.source ?? 'unknown',
    fetched: raw.length,
    embedded: 0,
    upserted: 0,
    skipped: 0,
    errors: [],
  }
  if (raw.length === 0) return report

  if (!isDbConfigured()) {
    throw new Error('MONGODB_URI is not set. Configure Atlas before ingesting documents.')
  }

  const harness = await getActiveHarness(projectId).catch(() => undefined)
  const docs = await collection('documents')
  const nowIso = new Date().toISOString()

  const ops: Array<{
    replaceOne: { filter: Record<string, unknown>; replacement: KnowledgeDoc; upsert: boolean }
  }> = []

  for (const item of raw) {
    const text = `${item.title}\n\n${item.text}`.trim()
    if (!text) {
      report.skipped += 1
      continue
    }
    try {
      const embedding = await embed(text, harness)
      report.embedded += 1
      const doc: KnowledgeDoc = { ...item, embedding, ingestedAt: nowIso }
      ops.push({
        replaceOne: {
          filter: { projectId: item.projectId, source: item.source, sourceId: item.sourceId },
          replacement: doc,
          upsert: true,
        },
      })
    } catch (error) {
      report.errors.push(`${item.sourceId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (ops.length) {
    const result = await docs.bulkWrite(ops as Parameters<typeof docs.bulkWrite>[0])
    report.upserted = (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0)
  }
  return report
}

/** Deterministic id helper so re-ingesting the same item is idempotent. */
export function docId(projectId: string, source: string, sourceId: string): string {
  return `${projectId}:${source}:${sourceId}`
}

/** Collapse whitespace and cap very long content for embedding + storage. */
export function normalizeText(text: string, maxChars = 8000): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxChars ? collapsed.slice(0, maxChars) : collapsed
}
