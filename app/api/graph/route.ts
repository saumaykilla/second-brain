import { defaultProjectId } from '@/lib/env'
import { getGraph } from '@/lib/graph'

export const dynamic = 'force-dynamic'

// GET /api/graph?projectId= -> nodes + edges for the memory graph (f-b-09).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || defaultProjectId()
  const graph = await getGraph(projectId)
  return Response.json({ ok: true, projectId, ...graph })
}
