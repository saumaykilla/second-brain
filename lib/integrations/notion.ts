// Notion integration: pull pages into the documents collection.
//
// Uses the Notion REST API directly (no SDK dependency). A Notion internal
// integration token (NOTION_TOKEN) with read access to the shared pages is
// required. We search for pages the integration can see, read their title and
// text, and hand them to ingestDocuments (embed + upsert).

import { readEnv } from '../env'
import { docId, ingestDocuments, normalizeText, type IngestReport, type RawDoc } from './ingest-docs'

const NOTION_VERSION = '2022-06-28'
const API = 'https://api.notion.com/v1'

function authHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    'notion-version': NOTION_VERSION,
    'content-type': 'application/json',
  }
}

interface NotionRichText {
  plain_text?: string
}
interface NotionPage {
  id: string
  url?: string
  created_time?: string
  last_edited_time?: string
  properties?: Record<string, { type: string; title?: NotionRichText[]; rich_text?: NotionRichText[] }>
}
interface NotionBlock {
  type: string
  [key: string]: unknown
}

/** Extract a page title from its properties (title-typed property). */
function pageTitle(page: NotionPage): string {
  const props = page.properties ?? {}
  for (const value of Object.values(props)) {
    if (value.type === 'title' && value.title?.length) {
      return value.title.map((t) => t.plain_text ?? '').join('').trim() || 'Untitled'
    }
  }
  return 'Untitled'
}

/** Pull the plain text out of a page's top-level blocks. */
async function pageText(token: string, pageId: string): Promise<string> {
  const res = await fetch(`${API}/blocks/${pageId}/children?page_size=100`, { headers: authHeaders(token) })
  if (!res.ok) return ''
  const data = (await res.json()) as { results?: NotionBlock[] }
  const lines: string[] = []
  for (const block of data.results ?? []) {
    const rich = (block[block.type] as { rich_text?: NotionRichText[] } | undefined)?.rich_text
    if (rich?.length) lines.push(rich.map((r) => r.plain_text ?? '').join(''))
  }
  return lines.join('\n')
}

/** Search for pages this integration can access. */
async function searchPages(token: string, limit: number): Promise<NotionPage[]> {
  const pages: NotionPage[] = []
  let cursor: string | undefined
  while (pages.length < limit) {
    const res = await fetch(`${API}/search`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        page_size: Math.min(100, limit - pages.length),
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Notion search failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { results?: NotionPage[]; has_more?: boolean; next_cursor?: string }
    pages.push(...(data.results ?? []))
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }
  return pages.slice(0, limit)
}

export async function ingestNotion(projectId: string, opts: { limit?: number } = {}): Promise<IngestReport> {
  const token = readEnv().NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN is not set.')
  const limit = opts.limit ?? 100

  const pages = await searchPages(token, limit)
  const raw: RawDoc[] = []
  for (const page of pages) {
    const title = pageTitle(page)
    const body = await pageText(token, page.id)
    raw.push({
      _id: docId(projectId, 'notion', page.id),
      projectId,
      source: 'notion',
      kind: 'note',
      sourceId: page.id,
      title,
      text: normalizeText(body || title),
      url: page.url,
      createdAt: page.created_time ?? new Date().toISOString(),
      updatedAt: page.last_edited_time,
    })
  }
  return ingestDocuments(projectId, raw)
}
