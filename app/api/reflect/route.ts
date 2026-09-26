import { getActiveHarness } from '@/lib/contracts/get-active-harness'
import { defaultProjectId } from '@/lib/env'
import { runEval } from '@/lib/eval/runner'
import { proposeFromSignals, reflectAndPromote } from '@/lib/harness/reflection'
import { promoteVersion, recordRejection } from '@/lib/harness/store'
import type { HarnessConfig, HarnessScores } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/reflect { projectId? } -> run one reflection cycle (f-b-07, f-b-08).
export async function POST(request: Request) {
  let projectId = defaultProjectId()
  try {
    const body = (await request.json()) as { projectId?: string }
    if (body.projectId) projectId = body.projectId
  } catch {
    // empty body is fine
  }

  const scoreWith = async (_c: HarnessConfig): Promise<HarnessScores> => {
    const r = await runEval(projectId)
    return {
      deadEndPrecision: r.deadEndPrecision,
      deadEndRecall: r.deadEndRecall,
      citationAccuracy: r.citationAccuracy,
      staleness: r.staleness,
      overall: r.overall,
    }
  }

  const parent = await getActiveHarness(projectId)
  const parentScores = parent.scores ?? (await scoreWith(parent))
  const proposal = proposeFromSignals(parentScores, 0)
  const result = await reflectAndPromote({ parent, parentScores, proposal, scoreCandidate: scoreWith })

  if (result.promoted) await promoteVersion(projectId, result.candidate)
  else await recordRejection(projectId, result.candidate)

  return Response.json({
    ok: true,
    promoted: result.promoted,
    reason: result.reason,
    change: proposal.change,
    parentVersion: parent.version,
    candidateVersion: result.candidate.version,
    parentScores,
    candidateScores: result.candidateScores,
  })
}
