import { afterAll, describe, expect, it } from 'vitest'
import { GET, POST } from '@/app/api/capture/route'
import { closeDb, getDb } from '@/lib/db'

const projectId = `capture-test-${Date.now().toString(36)}`

function post(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

describe('capture route (f-b-10)', () => {
  it('rejects invalid JSON and empty text', async () => {
    const bad = await post('{not json')
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ ok: false, error: 'invalid_json' })

    const empty = await post({ text: '   ' })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toMatchObject({ ok: false })
  })

  it('labels what was captured', async () => {
    const cases: Array<[string, string]> = [
      ['We decided to use Server-Sent Events for live updates.', 'decision'],
      ['Tried socket.io on the serverless host and it failed after 60 seconds.', 'attempt_result'],
      ['Starting on the Postgres full-text spike today.', 'attempt_start'],
      ['Going to add socket.io so the board updates live.', 'intent'],
      ['Which auth library are we using now?', 'question'],
      ['lunch at noon', 'noise'],
    ]
    for (const [text, label] of cases) {
      const res = await post({ projectId, text })
      expect(res.status).toBe(200)
      const data = (await res.json()) as { ok: boolean; label: string; message: { text: string; source: string; author: string } }
      expect(data.ok).toBe(true)
      expect(data.label).toBe(label)
      expect(data.message).toMatchObject({ text, source: 'web', author: 'web' })
    }
  })

  it('keeps the author when one is given', async () => {
    const res = await post({ projectId, text: 'We decided to ship on Friday.', author: 'priya' })
    const data = (await res.json()) as { message: { author: string } }
    expect(data.message.author).toBe('priya')
  })
})

describe.skipIf(!process.env.MONGODB_URI)('capture route stores and lists (MongoDB)', () => {
  const storeProject = `${projectId}-store`

  afterAll(async () => {
    const db = await getDb()
    await db.collection('messages').deleteMany({ projectId: { $in: [projectId, storeProject] } })
    await closeDb()
  })

  it('stores a message and lists it most recent first', async () => {
    const first = await post({ projectId: storeProject, text: 'We decided to move search to Atlas Search.' })
    expect((await first.json()).duplicate).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await post({ projectId: storeProject, text: 'Tried Postgres LIKE for search and it failed at 40k rows.' })
    expect(second.status).toBe(200)

    const list = await GET(new Request(`http://localhost/api/capture?projectId=${storeProject}`))
    const data = (await list.json()) as { ok: boolean; projectId: string; messages: Array<{ text: string; label: string; projectId: string }> }
    expect(data.ok).toBe(true)
    expect(data.projectId).toBe(storeProject)
    expect(data.messages).toHaveLength(2)
    expect(data.messages[0]).toMatchObject({ text: 'Tried Postgres LIKE for search and it failed at 40k rows.', label: 'attempt_result' })
    expect(data.messages[1]).toMatchObject({ text: 'We decided to move search to Atlas Search.', label: 'decision' })
    expect(data.messages.every((m) => m.projectId === storeProject)).toBe(true)
  })

  it('does not list another project\u2019s captures', async () => {
    const list = await GET(new Request(`http://localhost/api/capture?projectId=${storeProject}-other`))
    const data = (await list.json()) as { messages: unknown[] }
    expect(data.messages).toEqual([])
  })
})
