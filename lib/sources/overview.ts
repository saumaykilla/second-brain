// What the Sources page shows (f-a-10): connection state, the catalog the
// person can pick from, and the files and pages already synced. No tokens.

import { isDbConfigured } from '../db'
import { listGithubRepos } from './github'
import { listNotionPages } from './notion'
import { loadConnection, oauthConfigured, publicConnection } from './oauth'
import { sourceChunks } from './store'
import type { CatalogItem, PublicConnection, SourceProvider, SyncedDoc } from './types'

export interface ProviderOverview extends PublicConnection {
  provider: SourceProvider
  configured: boolean
  items: CatalogItem[]
  reason?: string
}

export interface SourcesOverview {
  projectId: string
  dbConfigured: boolean
  github: ProviderOverview
  notion: ProviderOverview
  docs: SyncedDoc[]
}

async function providerOverview(projectId: string, provider: SourceProvider): Promise<ProviderOverview> {
  const configured = oauthConfigured(provider)
  const base: ProviderOverview = { provider, configured, connected: false, account: '', selected: [], items: [] }
  if (!isDbConfigured()) return { ...base, reason: 'db_not_configured' }
  const connection = await loadConnection(projectId, provider)
  const view = { ...base, ...publicConnection(connection) }
  if (!connection) return view
  try {
    view.items =
      provider === 'github'
        ? await listGithubRepos(connection.accessToken)
        : await listNotionPages(connection.accessToken)
  } catch {
    view.reason = `${provider}_list_failed`
  }
  return view
}

export async function listSyncedDocs(projectId: string): Promise<SyncedDoc[]> {
  if (!isDbConfigured()) return []
  const coll = await sourceChunks()
  const rows = await coll
    .aggregate<{
      _id: { provider: SourceProvider; sourceId: string; docId: string }
      title: string
      url: string
      chunks: number
      updatedAt: Date
    }>([
      { $match: { projectId } },
      {
        $group: {
          _id: { provider: '$provider', sourceId: '$sourceId', docId: '$docId' },
          title: { $first: '$title' },
          url: { $first: '$url' },
          chunks: { $sum: 1 },
          updatedAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { '_id.provider': 1, title: 1 } },
      { $limit: 500 },
    ])
    .toArray()
  return rows.map((row) => ({
    provider: row._id.provider,
    sourceId: row._id.sourceId,
    docId: row._id.docId,
    title: row.title,
    url: row.url,
    chunks: row.chunks,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ''),
  }))
}

export async function sourcesOverview(projectId: string): Promise<SourcesOverview> {
  const [github, notion, docs] = await Promise.all([
    providerOverview(projectId, 'github'),
    providerOverview(projectId, 'notion'),
    listSyncedDocs(projectId),
  ])
  return { projectId, dbConfigured: isDbConfigured(), github, notion, docs }
}
