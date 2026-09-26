import { listHarnessVersions } from '@/lib/harness/store'
import { getActiveHarness } from '@/lib/contracts/get-active-harness'

export const dynamic = 'force-dynamic'

// GET /api/harness?projectId= -> version history + the active version (f-b-08).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || 'orbit'
  const versions = await listHarnessVersions(projectId)
  // The active version is the one flagged active in the history; fall back to the
  // contract's active harness when the history has no explicit active flag.
  const activeInList = versions.find((v) => v.active)
  const active = activeInList ?? (await getActiveHarness(projectId))
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
