import { defaultProjectId } from '@/lib/env'
import { grantSelection, isSourceProvider } from '@/lib/sources'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/sources/:provider/selection { projectId?, ids: string[] } (f-a-10).
// Reads only the selected repositories or pages and prunes the rest.
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  if (!isSourceProvider(provider)) return Response.json({ ok: false, error: 'unknown_provider' }, { status: 404 })

  let body: { projectId?: string; ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
  const projectId = body.projectId?.trim() || defaultProjectId()

  try {
    const result = await grantSelection(projectId, provider, ids)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'selection_failed'
    const notConnected = message.endsWith('_not_connected')
    return Response.json({ ok: false, error: message.split(':')[0] }, { status: notConnected ? 400 : 502 })
  }
}
