// Notion reads for connected pages (f-a-10). Lists what the integration was
// shared with and reads the plain text of a granted page or database.

import type { CatalogItem, SourceFile } from './types'

const NOTION_VERSION = '2022-06-28'
const MAX_DATABASE_PAGES = 50
const MAX_BLOCK_PAGES = 10

type RichText = Array<{ plain_text?: string }>

interface NotionObject {
  object?: string
  id?: string
  url?: string
  title?: RichText
  properties?: Record<string, { type?: string; title?: RichText }>
}

interface Block {
  id?: string
  type?: string
  has_children?: boolean
  [key: string]: unknown
}

function headers(token: string): HeadersInit {
  return { authorization: `Bearer ${token}`, 'notion-version': NOTION_VERSION, 'content-type': 'application/json' }
}

function joinRich(parts: RichText | undefined): string {
  return (parts ?? []).map((part) => part.plain_text ?? '').join('').trim()
}

export function notionTitle(item: NotionObject): string {
  if (item.object === 'database') return joinRich(item.title) || 'Untitled database'
  for (const value of Object.values(item.properties ?? {})) {
    if (value?.type === 'title') {
      const text = joinRich(value.title)
      if (text) return text
    }
  }
  return 'Untitled'
}

/** Plain text of a list of blocks. Headings are kept as markdown headings. */
export function notionPlainText(blocks: Block[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    const kind = block.type ?? ''
    const data = block[kind]
    if (kind === 'child_page') {
      const title = (data as { title?: string } | undefined)?.title
      if (title) lines.push(`Page: ${title}`)
      continue
    }
    if (!data || typeof data !== 'object') continue
    const text = joinRich((data as { rich_text?: RichText }).rich_text)
    if (!text) continue
    if (kind.startsWith('heading')) lines.push(`# ${text}`)
    else if (kind === 'bulleted_list_item' || kind === 'numbered_list_item') lines.push(`- ${text}`)
    else lines.push(text)
  }
  return lines.join('\n')
}

export async function listNotionPages(token: string): Promise<CatalogItem[]> {
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ page_size: 50, sort: { direction: 'descending', timestamp: 'last_edited_time' } }),
  })
  if (!res.ok) throw new Error(`notion_list_failed: ${res.status}`)
  const data = (await res.json()) as { results?: NotionObject[] }
  return (data.results ?? [])
    .filter((item) => item.id && (item.object === 'page' || item.object === 'database'))
    .map((item) => ({ id: item.id!, label: notionTitle(item), url: item.url, kind: item.object }))
}

async function blockChildren(token: string, blockId: string): Promise<Block[]> {
  const blocks: Block[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_BLOCK_PAGES; page++) {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`)
    url.searchParams.set('page_size', '100')
    if (cursor) url.searchParams.set('start_cursor', cursor)
    const res = await fetch(url, { headers: headers(token) })
    if (res.status === 404) return blocks
    if (!res.ok) throw new Error(`notion_blocks_failed: ${res.status}`)
    const data = (await res.json()) as { results?: Block[]; has_more?: boolean; next_cursor?: string }
    blocks.push(...(data.results ?? []))
    if (!data.has_more || !data.next_cursor) break
    cursor = data.next_cursor
  }
  return blocks
}

async function readPage(token: string, page: NotionObject): Promise<SourceFile | null> {
  const id = page.id
  if (!id) return null
  const title = notionTitle(page)
  const body = notionPlainText(await blockChildren(token, id))
  const text = [title, body].filter(Boolean).join('\n\n')
  if (!text.trim()) return null
  return { docId: id, title, url: page.url ?? `https://www.notion.so/${id.replace(/-/g, '')}`, text }
}

/** Read one granted page, or every page of a granted database. */
export async function fetchNotionSource(token: string, id: string): Promise<SourceFile[]> {
  const page = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: headers(token) })
  if (page.ok) {
    const file = await readPage(token, (await page.json()) as NotionObject)
    return file ? [file] : []
  }
  if (page.status !== 404 && page.status !== 400) throw new Error(`notion_page_failed: ${page.status}`)

  const query = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ page_size: MAX_DATABASE_PAGES }),
  })
  if (!query.ok) throw new Error(`notion_database_failed: ${query.status}`)
  const rows = (((await query.json()) as { results?: NotionObject[] }).results ?? []).filter((row) => row.object === 'page')
  const files: SourceFile[] = []
  for (const row of rows) {
    const file = await readPage(token, row)
    if (file) files.push(file)
  }
  return files
}
