import { randomUUID } from 'node:crypto'
import { ingestMessage } from '@/lib/contracts'
import { defaultProjectId } from '@/lib/env'
import { readRecentMessages } from '@/lib/memory'

export const dynamic = 'force-dynamic'

// POST /api/capture { projectId?, text, author? } -> stores the message through
// the ingestMessage contract and returns what was saved (f-a-04, f-b-10).
export async function POST(request: Request) {
  let body: { projectId?: string; text?: string; author?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const text = body.text?.trim()
  if (!text) return Response.json({ ok: false, error: 'text is required' }, { status: 400 })
  const projectId = body.projectId?.trim() || defaultProjectId()
  const id = randomUUID()
  try {
    const result = await ingestMessage({
      projectId,
      source: 'web',
      sourceId: id,
      threadId: id,
      author: body.author?.trim() || 'web',
      text,
    })
    return Response.json({ ok: true, ...result })
  } catch {
    return Response.json({ ok: false, error: 'capture_failed' }, { status: 500 })
  }
}

// GET /api/capture?projectId= -> the project's recent captures.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')?.trim() || defaultProjectId()
  try {
    const messages = await readRecentMessages(projectId)
    return Response.json({ ok: true, projectId, messages })
  } catch {
    return Response.json({ ok: false, error: 'capture_unavailable' }, { status: 500 })
  }
}
