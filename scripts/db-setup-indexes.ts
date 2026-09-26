import type { IndexDescription } from 'mongodb'
import { EMBEDDING_DIMENSIONS, type CollectionName } from '../lib/types'

export const STANDARD_INDEXES: Partial<Record<CollectionName, IndexDescription[]>> = {
  messages: [
    { key: { projectId: 1, source: 1, sourceId: 1 }, name: 'source_unique', unique: true },
    { key: { projectId: 1, threadId: 1, postedAt: 1 }, name: 'thread_time' },
  ],
  attempts: [{ key: { projectId: 1, status: 1, startedAt: -1 }, name: 'project_status_time' }],
  decisions: [{ key: { projectId: 1, status: 1, decidedAt: -1 }, name: 'project_status_time' }],
  entities: [{ key: { projectId: 1, name: 1 }, name: 'project_name', unique: true }],
  edges: [
    { key: { projectId: 1, 'from.id': 1 }, name: 'from' },
    { key: { projectId: 1, 'to.id': 1 }, name: 'to' },
  ],
  warnings: [{ key: { projectId: 1, createdAt: -1 }, name: 'project_time' }],
  feedback: [{ key: { projectId: 1, 'target.id': 1 }, name: 'target' }],
  harness_configs: [
    { key: { projectId: 1, version: 1 }, name: 'project_version', unique: true },
    { key: { projectId: 1 }, name: 'one_active', unique: true, partialFilterExpression: { active: true } },
  ],
  traces: [{ key: { projectId: 1, messageId: 1 }, name: 'message' }],
  documents: [
    { key: { projectId: 1, source: 1, sourceId: 1 }, name: 'source_unique', unique: true },
    { key: { projectId: 1, kind: 1, createdAt: -1 }, name: 'kind_time' },
  ],
}

export interface SearchIndexSpec {
  collection: CollectionName
  name: string
  type: 'vectorSearch' | 'search'
  definition: Record<string, unknown>
}

const vector = (filters: string[]) => ({
  fields: [
    { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
    ...filters.map((path) => ({ type: 'filter', path })),
  ],
})

// Core search indexes. M0 (free) Atlas clusters allow three search indexes in
// total, so this list stays at three and always works on the free tier.
export const SEARCH_INDEXES: SearchIndexSpec[] = [
  { collection: 'attempts', name: 'attempts_vector', type: 'vectorSearch', definition: vector(['projectId', 'outcome', 'status']) },
  { collection: 'decisions', name: 'decisions_vector', type: 'vectorSearch', definition: vector(['projectId', 'status']) },
  {
    collection: 'documents',
    name: 'documents_vector',
    type: 'vectorSearch',
    definition: vector(['projectId', 'source', 'kind']),
  },
]

// Extended search indexes for the general knowledge experience. These push the
// total beyond the M0 limit of three, so they require a paid tier (M10+). The
// setup script attempts them and skips gracefully if the cluster rejects them.
export const EXTENDED_SEARCH_INDEXES: SearchIndexSpec[] = [
  {
    collection: 'documents',
    name: 'documents_text',
    type: 'search',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          projectId: { type: 'token' },
          source: { type: 'token' },
          kind: { type: 'token' },
          title: { type: 'string' },
          text: { type: 'string' },
          tags: { type: 'string' },
        },
      },
    },
  },
  {
    collection: 'attempts',
    name: 'memory_text',
    type: 'search',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          projectId: { type: 'token' },
          goal: { type: 'string' },
          approach: { type: 'string' },
          alternative: { type: 'string' },
          blockers: { type: 'document', fields: { detail: { type: 'string' } } },
        },
      },
    },
  },
]
