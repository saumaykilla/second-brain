import { ingestGithub } from '@/lib/integrations/github'
import { checkIngestAuth } from '@/lib/integrations/guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/ingest/github { projectId?, repos?: string[], perRepo? }
export async function POST(request: Request) {
  const auth = checkIngestAuth(request)
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { projectId?: string; repos?: string[]; perRepo?: number } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // empty body allowed
  }
  const projectId = body.projectId?.trim() || 'orbit'
  try {
    const report = await ingestGithub(projectId, { repos: body.repos, perRepo: body.perRepo })
    return Response.json({ ok: true, report })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
