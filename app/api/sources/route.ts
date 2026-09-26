import { defaultProjectId } from '@/lib/env'
import { sourcesOverview } from '@/lib/sources'

export const dynamic = 'force-dynamic'

// GET /api/sources?projectId= -> connection state, catalog, synced docs (f-a-10).
// Never includes access tokens or client secrets.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')?.trim() || defaultProjectId()
  try {
    const overview = await sourcesOverview(projectId)
    return Response.json({ ok: true, ...overview })
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message.split(':')[0] : 'sources_failed' },
      { status: 500 },
    )
  }
}
