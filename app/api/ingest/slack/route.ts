import { ingestSlack } from '@/lib/integrations/slack'
import { checkIngestAuth } from '@/lib/integrations/guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/ingest/slack { projectId?, channels: string[], perChannel? }
export async function POST(request: Request) {
  const auth = checkIngestAuth(request)
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { projectId?: string; channels?: string[]; perChannel?: number } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // empty body allowed
  }
  const projectId = body.projectId?.trim() || 'orbit'
  if (!body.channels?.length) {
    return Response.json({ ok: false, error: 'channels[] is required' }, { status: 400 })
  }
  try {
    const report = await ingestSlack(projectId, { channels: body.channels, perChannel: body.perChannel })
    return Response.json({ ok: true, report })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
