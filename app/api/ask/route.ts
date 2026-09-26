import { answerQuestion } from '@/lib/answer'
import { defaultProjectId } from '@/lib/env'

export const dynamic = 'force-dynamic'

// POST /api/ask { projectId?, question } -> cited answer (f-b-03, f-a-10).
export async function POST(request: Request) {
  let body: { projectId?: string; question?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const projectId = body.projectId?.trim() || defaultProjectId()
  const question = body.question?.trim()
  if (!question) {
    return Response.json({ ok: false, error: 'question is required' }, { status: 400 })
  }
  const result = await answerQuestion(projectId, question)
  return Response.json({ ok: true, ...result })
}
