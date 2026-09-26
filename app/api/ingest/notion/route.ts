import { ingestNotion } from '@/lib/integrations/notion'
import { checkIngestAuth } from '@/lib/integrations/guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/ingest/notion { projectId?, limit? }  (guarded by INGEST_SECRET)
export async function POST(request: Request) {
  const auth = checkIngestAuth(request)
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { projectId?: string; limit?: number } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // empty body is allowed
  }
  const projectId = body.projectId?.trim() || 'orbit'
  try {
    const report = await ingestNotion(projectId, { limit: body.limit })
    return Response.json({ ok: true, report })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
