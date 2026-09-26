// Sync granted sources into source_chunks (f-a-10). Only the ids the person
// selected are read. Chunks of sources that were unchecked are removed.

import type { AnyBulkWriteOperation } from 'mongodb'
import { embedMany, embeddingProvider } from '../models'
import { chunkText } from './chunks'
import { fetchGithubFiles } from './github'
import { fetchNotionSource } from './notion'
import { loadConnection } from './oauth'
import { integrations, sourceChunks } from './store'
import type { SourceChunk, SourceFile, SourceProvider } from './types'

export const MAX_CHUNKS_PER_SOURCE = 600

export function chunkId(projectId: string, provider: SourceProvider, sourceId: string, docId: string, order: number): string {
  return `${projectId}:${provider}:${sourceId}:${docId}#${order}`
}

/** Store the chunks of one source and drop chunks it no longer has. */
export async function storeSource(
  projectId: string,
  provider: SourceProvider,
  sourceId: string,
  files: SourceFile[],
): Promise<number> {
  const coll = await sourceChunks()
  const provider_ = embeddingProvider()
  const now = new Date()
  const pending: Array<{ _id: string; file: SourceFile; order: number; text: string }> = []
  outer: for (const file of files) {
    const pieces = chunkText(file.text)
    for (let order = 0; order < pieces.length; order++) {
      if (pending.length >= MAX_CHUNKS_PER_SOURCE) break outer
      pending.push({ _id: chunkId(projectId, provider, sourceId, file.docId, order), file, order, text: pieces[order] })
    }
  }

  const embeddings = await embedMany(pending.map((p) => `${p.file.title}\n${p.text}`))
  const kept = pending.map((p) => p._id)
  const ops: AnyBulkWriteOperation<SourceChunk>[] = pending.map((p, index) => ({
    replaceOne: {
      filter: { _id: p._id },
      replacement: {
        projectId,
        provider,
        sourceId,
        docId: p.file.docId,
        title: p.file.title,
        url: p.file.url,
        order: p.order,
        text: p.text,
        embedding: embeddings[index],
        embeddingProvider: provider_,
        updatedAt: now,
      },
      upsert: true,
    },
  }))

  if (ops.length) await coll.bulkWrite(ops, { ordered: false })
  await coll.deleteMany({ projectId, provider, sourceId, _id: { $nin: kept } })
  return kept.length
}

export interface GrantResult {
  provider: SourceProvider
  selected: string[]
  synced: number
  chunks: number
}

/** Save the person's selection, read those sources, and prune the rest. */
export async function grantSelection(projectId: string, provider: SourceProvider, ids: string[]): Promise<GrantResult> {
  const connection = await loadConnection(projectId, provider)
  if (!connection) throw new Error(`${provider}_not_connected`)
  const selected = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]

  await (await integrations()).updateOne({ projectId, provider }, { $set: { selected, updatedAt: new Date() } })

  let chunks = 0
  for (const sourceId of selected) {
    const files =
      provider === 'github'
        ? await fetchGithubFiles(connection.accessToken, sourceId)
        : await fetchNotionSource(connection.accessToken, sourceId)
    chunks += await storeSource(projectId, provider, sourceId, files)
  }

  await (await sourceChunks()).deleteMany({ projectId, provider, sourceId: { $nin: selected } })
  return { provider, selected, synced: selected.length, chunks }
}
