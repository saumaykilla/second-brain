import { collection, isDbConfigured } from '@/lib/db'
import { listHarnessVersions } from '@/lib/harness/store'
import type { Feedback, Warning } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/impact?projectId= -> warnings sent, hours saved from ACCEPTED
// warnings, and the precision trend across harness versions (R27, f-b-08).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || 'orbit'

  const versions = await listHarnessVersions(projectId)
  const precisionTrend = versions
    .filter((v) => v.scores)
    .map((v) => ({ version: v.version, precision: v.scores!.deadEndPrecision, overall: v.scores!.overall }))

  if (!isDbConfigured()) {
    return Response.json({
      ok: true,
      projectId,
      warningsSent: 0,
      hoursSaved: 0,
      note: 'No database configured; warnings accrue once Slack/Check warnings are recorded.',
      precisionTrend,
    })
  }

  const warnings = (await (await collection('warnings')).find({ projectId }).toArray()) as Warning[]
  const feedback = (await (await collection('feedback')).find({ projectId }).toArray()) as Feedback[]

  // A warning is "accepted" unless it was explicitly marked not_relevant (R21, R27).
  const notRelevant = new Set(
    feedback.filter((f) => f.target.kind === 'warning' && f.verdict === 'not_relevant').map((f) => f.target.id),
  )
  const accepted = warnings.filter((w) => !notRelevant.has(w._id))
  const hoursSaved = accepted.reduce((sum, w) => sum + w.hoursSaved, 0)

  return Response.json({
    ok: true,
    projectId,
    warningsSent: warnings.length,
    warningsAccepted: accepted.length,
    hoursSaved,
    precisionTrend,
  })
}
