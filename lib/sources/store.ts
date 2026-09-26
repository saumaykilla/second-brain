// MongoDB access for connected sources (f-a-10). Indexes are created on first
// use so db:setup and lib/types.ts stay untouched. No Atlas Search index is
// needed: candidates come from a standard text index and are re-ranked by
// cosine similarity in searchSources.

import type { Collection, Db } from 'mongodb'
import { getDb } from '../db'
import type { Integration, OAuthState, SourceChunk } from './types'

const globalForSources = globalThis as unknown as { __sourceIndexes?: Promise<void> }

async function ensureIndexes(db: Db): Promise<void> {
  await db
    .collection('integrations')
    .createIndex({ projectId: 1, provider: 1 }, { unique: true, name: 'project_provider' })
  await db.collection('oauth_states').createIndex({ state: 1 }, { unique: true, name: 'state' })
  await db.collection('oauth_states').createIndex({ createdAt: 1 }, { expireAfterSeconds: 900, name: 'ttl' })
  await db
    .collection('source_chunks')
    .createIndex({ projectId: 1, provider: 1, sourceId: 1 }, { name: 'project_source' })
  await db
    .collection('source_chunks')
    .createIndex({ title: 'text', text: 'text' }, { name: 'chunk_text', default_language: 'english' })
}

export async function sourcesDb(): Promise<Db> {
  const db = await getDb()
  if (!globalForSources.__sourceIndexes) {
    globalForSources.__sourceIndexes = ensureIndexes(db).catch((error) => {
      globalForSources.__sourceIndexes = undefined
      throw error
    })
  }
  await globalForSources.__sourceIndexes
  return db
}

export async function integrations(): Promise<Collection<Integration>> {
  return (await sourcesDb()).collection<Integration>('integrations')
}

export async function oauthStates(): Promise<Collection<OAuthState>> {
  return (await sourcesDb()).collection<OAuthState>('oauth_states')
}

export async function sourceChunks(): Promise<Collection<SourceChunk>> {
  return (await sourcesDb()).collection<SourceChunk>('source_chunks')
}
