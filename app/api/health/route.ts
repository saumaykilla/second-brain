export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true, service: 'second-brain', time: new Date().toISOString() })
}
