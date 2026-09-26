import { collection, isDbConfigured } from '@/lib/db'
import { defaultProjectId } from '@/lib/env'
import { listHarnessVersions } from '@/lib/harness/store'
import { getFixture } from '@/lib/fixtures'
import type { Feedback, Warning } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/impact?projectId= -> warnings sent, hours saved from ACCEPTED
// warnings, and the precision trend across harness versions (R27, f-b-08).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || defaultProjectId()

  const versions = await listHarnessVersions(projectId)
  const precisionTrend = versions
    .filter((v) => v.scores)
    .map((v) => ({ version: v.version, precision: v.scores!.deadEndPrecision, overall: v.scores!.overall }))

  if (!isDbConfigured()) {
    // No database: use the seeded demo warnings from the fixture so Impact shows
    // real numbers. All seeded warnings are treated as accepted.
    const seeded = getFixture(projectId)?.warnings ?? []
    return Response.json({
      ok: true,
      projectId,
      warningsSent: seeded.length,
      warningsAccepted: seeded.length,
      hoursSaved: seeded.reduce((sum, w) => sum + w.hoursSaved, 0),
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
