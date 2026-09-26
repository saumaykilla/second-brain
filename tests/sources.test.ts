import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { answerQuestion, excerptOf } from '@/lib/answer'
import { closeDb, getDb } from '@/lib/db'
import { chunkText } from '@/lib/sources/chunks'
import { wantedPath } from '@/lib/sources/github'
import { notionPlainText, notionTitle } from '@/lib/sources/notion'
import { githubAuthorizeUrl, notionAuthorizeUrl, publicConnection, saveConnection } from '@/lib/sources/oauth'
import { sourcesOverview } from '@/lib/sources/overview'
import { rankCandidates, searchSources } from '@/lib/sources/search'
import { grantSelection } from '@/lib/sources/sync'
import type { SourceChunk } from '@/lib/sources/types'
import { localEmbed } from '@/lib/models'

const SECRET = 'client-secret-never-in-a-url'
const TOKEN = 'user-token-never-in-a-response'

describe('sources: pure pieces (f-a-10)', () => {
  it('builds authorize URLs with the client id and without the secret', () => {
    const github = githubAuthorizeUrl('gh-client', 'http://localhost:3000/api/sources/github/callback', 'state-1')
    const notion = notionAuthorizeUrl('no-client', 'http://localhost:3000/api/sources/notion/callback', 'state-2')
    expect(github).toContain('client_id=gh-client')
    expect(github).toContain('state=state-1')
    expect(github.startsWith('https://github.com/login/oauth/authorize?')).toBe(true)
    expect(notion).toContain('client_id=no-client')
    expect(notion).toContain('owner=user')
    expect(notion.startsWith('https://api.notion.com/v1/oauth/authorize?')).toBe(true)
    for (const url of [github, notion]) {
      expect(url).not.toContain(SECRET)
      expect(url).not.toContain('client_secret')
    }
  })

  it('chunks long text with overlap and keeps short text whole', () => {
    expect(chunkText('short note')).toEqual(['short note'])
    const long = Array.from({ length: 60 }, (_, i) => `line ${i} ${'x'.repeat(40)}`).join('\n')
    const chunks = chunkText(long, 500, 100)
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500)
    // The start of each chunk repeats the tail of the one before it.
    expect(chunks[0]).toContain(chunks[1].slice(0, 40))
    expect(chunkText('   ')).toEqual([])
  })

  it('reads source files and skips vendored, binary, and lock files', () => {
    expect(wantedPath('app/api/socket.ts')).toBe(true)
    expect(wantedPath('docs/README.md')).toBe(true)
    expect(wantedPath('node_modules/left-pad/index.js')).toBe(false)
    expect(wantedPath('public/logo.png')).toBe(false)
    expect(wantedPath('package-lock.json')).toBe(false)
    expect(wantedPath('big.md', 5_000_000)).toBe(false)
  })

  it('extracts Notion titles and plain text', () => {
    expect(notionTitle({ object: 'database', title: [{ plain_text: 'Specs' }] })).toBe('Specs')
    expect(notionTitle({ object: 'page', properties: { Name: { type: 'title', title: [{ plain_text: 'Delivery' }] } } })).toBe('Delivery')
    expect(notionTitle({ object: 'page', properties: {} })).toBe('Untitled')
    const text = notionPlainText([
      { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Delivery' }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Delivery may be delayed up to 5 seconds.' }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Retry once' }] } },
      { type: 'child_page', child_page: { title: 'Appendix' } },
    ])
    expect(text).toBe('# Delivery\nDelivery may be delayed up to 5 seconds.\n- Retry once\nPage: Appendix')
  })

  it('ranks the chunk that matches the question first', () => {
    const make = (id: string, text: string, textScore?: number): SourceChunk & { textScore?: number } => ({
      _id: id,
      projectId: 'p',
      provider: 'github',
      sourceId: 'ada/app',
      docId: id,
      title: id,
      url: `https://github.com/ada/app/blob/main/${id}`,
      order: 0,
      text,
      embedding: localEmbed(text),
      embeddingProvider: 'local',
      updatedAt: new Date(),
      textScore,
    })
    const query = 'why does the socket hang up on app runner'
    const hits = rankCandidates(
      [
        make('billing.ts', 'invoice totals and tax rounding for the billing page', 0.2),
        make('socket.ts', 'Error: socket hang up when websockets run on App Runner behind the load balancer', 3.1),
      ],
      query,
      localEmbed(query),
      'local',
      2,
    )
    expect(hits[0].docId).toBe('socket.ts')
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  it('cuts an excerpt around the matching term', () => {
    const text = `${'a '.repeat(300)}The delivery window is five seconds. ${'b '.repeat(300)}`
    const excerpt = excerptOf(text, 'what is the delivery window')
    expect(excerpt).toContain('delivery window')
    expect(excerpt.length).toBeLessThanOrEqual(284)
  })
})

// --- Integration against MongoDB with mocked provider APIs -----------------

const hasDb = Boolean(process.env.MONGODB_URI)
const projectId = `sources-test-${Date.now().toString(36)}`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function fakeProviderFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
  const path = url.pathname
  // GitHub
  if (url.host === 'api.github.com') {
    if (path === '/user/repos') return Promise.resolve(jsonResponse([{ full_name: 'ada/app' }, { full_name: 'ada/other', private: true }]))
    if (path === '/repos/ada/app') return Promise.resolve(jsonResponse({ default_branch: 'main' }))
    if (path === '/repos/ada/app/git/trees/main')
      return Promise.resolve(
        jsonResponse({
          tree: [
            { path: 'app/api/socket.ts', type: 'blob', size: 120 },
            { path: 'node_modules/x/index.js', type: 'blob', size: 10 },
            { path: 'logo.png', type: 'blob', size: 10 },
          ],
        }),
      )
    if (path === '/repos/ada/app/contents/app/api/socket.ts')
      return Promise.resolve(
        new Response('export const server = io(); // Error: socket hang up after 60s on App Runner, so we moved to SSE plus polling'),
      )
    if (path.startsWith('/repos/ada/other')) return Promise.resolve(jsonResponse({ default_branch: 'main' }))
    if (path === '/repos/ada/other/git/trees/main')
      return Promise.resolve(jsonResponse({ tree: [{ path: 'SECRET.md', type: 'blob', size: 10 }] }))
  }
  // Notion
  if (url.host === 'api.notion.com') {
    if (path === '/v1/search')
      return Promise.resolve(
        jsonResponse({
          results: [
            { object: 'page', id: 'page-keep', url: 'https://www.notion.so/page-keep', properties: { Name: { type: 'title', title: [{ plain_text: 'Notifications spec' }] } } },
            { object: 'page', id: 'page-skip', url: 'https://www.notion.so/page-skip', properties: { Name: { type: 'title', title: [{ plain_text: 'Skip me' }] } } },
          ],
        }),
      )
    if (path === '/v1/pages/page-keep')
      return Promise.resolve(
        jsonResponse({ object: 'page', id: 'page-keep', url: 'https://www.notion.so/page-keep', properties: { Name: { type: 'title', title: [{ plain_text: 'Notifications spec' }] } } }),
      )
    if (path === '/v1/blocks/page-keep/children')
      return Promise.resolve(
        jsonResponse({
          results: [
            { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Delivery' }] } },
            { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Delivery may be delayed up to 5 seconds.' }] } },
          ],
          has_more: false,
        }),
      )
    if (path === '/v1/pages/page-skip') return Promise.resolve(jsonResponse({ object: 'page', id: 'page-skip', properties: {} }))
    if (path === '/v1/blocks/page-skip/children') return Promise.resolve(jsonResponse({ results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'must not be stored' }] } }], has_more: false }))
  }
  return Promise.resolve(jsonResponse({ error: `unexpected ${url.toString()}` }, 404))
}

describe.skipIf(!hasDb)('sources: connect, choose, ask (f-a-10, MongoDB)', () => {
  beforeAll(() => {
    process.env.EMBEDDINGS = 'local'
    delete process.env.OPENROUTER_API_KEY
    vi.stubGlobal('fetch', vi.fn(fakeProviderFetch))
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    const db = await getDb()
    await db.collection('integrations').deleteMany({ projectId })
    await db.collection('source_chunks').deleteMany({ projectId })
    await db.collection('oauth_states').deleteMany({ projectId })
    await closeDb()
  })

  it('stores a connection and never exposes the token', async () => {
    await saveConnection(projectId, 'github', { accessToken: TOKEN, account: 'ada' })
    await saveConnection(projectId, 'notion', { accessToken: TOKEN, account: 'Ada Workspace' })
    const overview = await sourcesOverview(projectId)
    expect(overview.github).toMatchObject({ connected: true, account: 'ada' })
    expect(overview.github.items.map((i) => i.id)).toEqual(['ada/app', 'ada/other'])
    expect(overview.notion.items.map((i) => i.id)).toEqual(['page-keep', 'page-skip'])
    expect(JSON.stringify(overview)).not.toContain(TOKEN)
    expect(publicConnection({ projectId, provider: 'github', accessToken: TOKEN, account: 'ada', selected: [], updatedAt: new Date() })).toEqual({ connected: true, account: 'ada', selected: [] })
  })

  it('reads only the selected repository and page', async () => {
    const github = await grantSelection(projectId, 'github', ['ada/app'])
    expect(github).toMatchObject({ provider: 'github', selected: ['ada/app'], synced: 1 })
    expect(github.chunks).toBeGreaterThan(0)
    const notion = await grantSelection(projectId, 'notion', ['page-keep'])
    expect(notion).toMatchObject({ provider: 'notion', selected: ['page-keep'], synced: 1 })

    const db = await getDb()
    const chunks = await db.collection('source_chunks').find({ projectId }).toArray()
    const sources = new Set(chunks.map((c) => c.sourceId))
    expect(sources).toEqual(new Set(['ada/app', 'page-keep']))
    expect(chunks.some((c) => c.docId === 'app/api/socket.ts')).toBe(true)
    expect(chunks.some((c) => c.docId.includes('node_modules'))).toBe(false)
    expect(JSON.stringify(chunks.map((c) => c.text))).not.toContain('must not be stored')

    const overview = await sourcesOverview(projectId)
    expect(overview.docs.map((d) => d.title).sort()).toEqual(['Notifications spec', 'ada/app/app/api/socket.ts'])
  })

  it('answers a question from the connected file and cites it', async () => {
    const hits = await searchSources(projectId, 'why did the socket hang up on App Runner', 3)
    expect(hits[0]?.docId).toBe('app/api/socket.ts')
    expect(hits[0]?.url).toBe('https://github.com/ada/app/blob/main/app/api/socket.ts')

    const result = await answerQuestion(projectId, 'why did the socket hang up on App Runner')
    expect(result.unsupported).toBe(false)
    const doc = result.citations.find((c) => c.kind === 'doc')
    expect(doc).toMatchObject({ provider: 'github', title: 'ada/app/app/api/socket.ts' })
    expect(doc?.url).toContain('github.com/ada/app')
    expect(result.answer).toContain('socket hang up')

    const notion = await answerQuestion(projectId, 'how long can delivery be delayed')
    expect(notion.citations.some((c) => c.kind === 'doc' && c.provider === 'notion')).toBe(true)
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it('does not return another project\u2019s sources', async () => {
    expect(await searchSources(`${projectId}-other`, 'socket hang up', 3)).toEqual([])
  })

  it('unchecking a source removes its chunks', async () => {
    await grantSelection(projectId, 'github', [])
    const db = await getDb()
    expect(await db.collection('source_chunks').countDocuments({ projectId, provider: 'github' })).toBe(0)
    expect(await db.collection('source_chunks').countDocuments({ projectId, provider: 'notion' })).toBeGreaterThan(0)
  })
})
