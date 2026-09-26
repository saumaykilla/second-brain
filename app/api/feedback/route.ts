import { randomUUID } from 'node:crypto'
import { collection, isDbConfigured } from '@/lib/db'
import { defaultProjectId } from '@/lib/env'
import type { Feedback } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/feedback { projectId, target:{kind,id}, verdict, note? }
// Records a helpful / not_relevant verdict on a warning, answer, or check so it
// can be read back and fed to reflection (R15, f-b-02, f-b-05, f-b-07).
export async function POST(request: Request) {
  let body: {
    projectId?: string
    target?: { kind?: 'warning' | 'answer' | 'check'; id?: string }
    verdict?: 'helpful' | 'not_relevant'
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const projectId = body.projectId?.trim() || defaultProjectId()
  const kind = body.target?.kind
  const id = body.target?.id?.trim()
  const verdict = body.verdict
  if (!kind || !id || (verdict !== 'helpful' && verdict !== 'not_relevant')) {
    return Response.json({ ok: false, error: 'target.kind, target.id, and verdict are required' }, { status: 400 })
  }

  const feedback: Feedback = {
    _id: randomUUID(),
    projectId,
    target: { kind, id },
    verdict,
    note: body.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }

  if (isDbConfigured()) {
    await (await collection('feedback')).insertOne(feedback)
  }

  return Response.json({ ok: true, stored: isDbConfigured(), feedback })
}

// GET /api/feedback?projectId=&targetId=  -> read feedback back (f-b-02 verify).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || defaultProjectId()
  const targetId = url.searchParams.get('targetId')

  if (!isDbConfigured()) {
    return Response.json({ ok: true, stored: false, feedback: [] })
  }
  const query: Record<string, unknown> = { projectId }
  if (targetId) query['target.id'] = targetId
  const feedback = await (await collection('feedback')).find(query).sort({ createdAt: -1 }).toArray()
  return Response.json({ ok: true, stored: true, feedback })
}
