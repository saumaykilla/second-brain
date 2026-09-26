// Connected sources (f-a-10). These shapes live outside lib/types.ts on
// purpose: they are owned by the ingest lane and do not change a contract.

import type { EmbeddingProvider } from '../models'

export type SourceProvider = 'github' | 'notion'

export const SOURCE_PROVIDERS: SourceProvider[] = ['github', 'notion']

export function isSourceProvider(value: string): value is SourceProvider {
  return (SOURCE_PROVIDERS as string[]).includes(value)
}

/** One connected account for one project. The token never leaves the server. */
export interface Integration {
  projectId: string
  provider: SourceProvider
  accessToken: string
  account: string
  /** Repository full names or Notion page/database ids the person granted. */
  selected: string[]
  updatedAt: Date
}

/** Pending OAuth round trip. Expires after fifteen minutes. */
export interface OAuthState {
  state: string
  projectId: string
  provider: SourceProvider
  createdAt: Date
}

/** What the browser may know about a connection. */
export interface PublicConnection {
  connected: boolean
  account: string
  selected: string[]
}

/** A repository or page the connected account can see. */
export interface CatalogItem {
  id: string
  label: string
  url?: string
  kind?: string
  private?: boolean
}

/** One file or page read from a provider before chunking. */
export interface SourceFile {
  docId: string
  title: string
  url: string
  text: string
}

/** A stored, embedded piece of a connected file or page. */
export interface SourceChunk {
  _id: string
  projectId: string
  provider: SourceProvider
  /** Repository full name or Notion page/database id. */
  sourceId: string
  /** File path or Notion page id. */
  docId: string
  title: string
  url: string
  order: number
  text: string
  embedding: number[]
  embeddingProvider: EmbeddingProvider
  updatedAt: Date
}

/** A synced file or page as shown on Sources. */
export interface SyncedDoc {
  provider: SourceProvider
  sourceId: string
  docId: string
  title: string
  url: string
  chunks: number
  updatedAt: string
}
