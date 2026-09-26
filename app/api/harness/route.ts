import { listHarnessVersions } from '@/lib/harness/store'
import { getActiveHarness } from '@/lib/contracts/get-active-harness'
import { defaultProjectId } from '@/lib/env'

export const dynamic = 'force-dynamic'

// GET /api/harness?projectId= -> version history + the active version (f-b-08).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || defaultProjectId()
  const versions = await listHarnessVersions(projectId)
  const active = await getActiveHarness(projectId)
  return Response.json({
    ok: true,
    projectId,
    active: active.version,
    versions: versions.map((v) => ({
      version: v.version,
      parentVersion: v.parentVersion ?? null,
      active: v.active,
      change: v.change ?? null,
      rejectedReason: v.rejectedReason ?? null,
      retrieval: v.retrieval,
      scores: v.scores ?? null,
    })),
  })
}
