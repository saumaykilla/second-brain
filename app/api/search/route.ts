import { getActiveHarness } from '@/lib/contracts/get-active-harness'
import { retrieveDocuments } from '@/lib/retrieval'
import type { DocSource } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST /api/search { projectId?, query, sources? } -> semantic search over the
// knowledge documents (Notion / Slack / GitHub / seeded), via Atlas vector search.
export async function POST(request: Request) {
  let body: { projectId?: string; query?: string; sources?: DocSource[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const projectId = body.projectId?.trim() || 'orbit'
  const query = body.query?.trim()
  if (!query) return Response.json({ ok: false, error: 'query is required' }, { status: 400 })

  let harness
  try {
    harness = await getActiveHarness(projectId)
  } catch {
    return Response.json({ ok: true, results: [] })
  }

  const hits = await retrieveDocuments(projectId, query, harness, { sources: body.sources, limit: 12 })
  return Response.json({
    ok: true,
    projectId,
    results: hits.map(({ doc, score }) => ({
      id: doc._id,
      title: doc.title,
      snippet: doc.text.slice(0, 240),
      source: doc.source,
      kind: doc.kind,
      url: doc.url ?? null,
      author: doc.author ?? null,
      tags: doc.tags ?? [],
      score: Math.round(score * 1000) / 1000,
    })),
  })
}
