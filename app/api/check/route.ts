import { checkDeadEnds } from '@/lib/contracts'
import { defaultProjectId } from '@/lib/env'
import type { Evidence } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/check  { projectId?, text }  -> dead-end matches (f-b-01, f-b-02).
// Returns the matching dead ends with blocker, evidence, alternative, hours,
// and confidence, or an explicit no-match. Enriches each match with the blocker
// and evidence for the Check-an-Idea screen.
export async function POST(request: Request) {
  let body: { projectId?: string; text?: string }
  try {
    body = (await request.json()) as { projectId?: string; text?: string }
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const projectId = body.projectId?.trim() || defaultProjectId()
  const text = body.text?.trim()
  if (!text) {
    return Response.json({ ok: false, error: 'text is required' }, { status: 400 })
  }

  const matches = await checkDeadEnds(projectId, text)

  const enriched = matches.map((m) => {
    const blocker = m.attempt.blockers[0]
    const evidence: Evidence[] = m.attempt.evidence ?? []
    return {
      attemptId: m.attempt._id,
      goal: m.attempt.goal,
      approach: m.attempt.approach,
      outcome: m.attempt.outcome,
      status: m.attempt.status,
      confidence: m.confidence,
      reason: m.reason,
      hoursSaved: m.hoursSaved,
      alternative: m.attempt.alternative ?? null,
      blocker: blocker ? { type: blocker.type, detail: blocker.detail } : null,
      evidence: evidence.map((e) => ({ kind: e.kind, summary: e.summary, url: e.url ?? null })),
    }
  })

  return Response.json({
    ok: true,
    projectId,
    matched: enriched.length > 0,
    matches: enriched,
  })
}
