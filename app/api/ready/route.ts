import { getDb } from '@/lib/db'
import { REQUIRED_BY_FEATURE, REQUIRED_FOR_READY, missingKeys, readEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const env = readEnv()
  const missing = missingKeys(REQUIRED_FOR_READY, env)
  const features = Object.fromEntries(
    Object.entries(REQUIRED_BY_FEATURE).map(([id, keys]) => [id, missingKeys(keys, env)]),
  )

  if (missing.length) {
    return Response.json({ ok: false, reason: 'missing_config', missing, features }, { status: 503 })
  }

  try {
    await (await getDb()).command({ ping: 1 })
  } catch {
    return Response.json({ ok: false, reason: 'mongodb_unreachable', missing: [], features }, { status: 503 })
  }

  return Response.json({ ok: true, mongodb: 'reachable', features })
}
