// Simple shared secret guard for the ingest API routes.
//
// Ingesting pulls external data and spends embedding tokens, so the routes are
// protected by INGEST_SECRET. Send it as `Authorization: Bearer <secret>` or
// `?secret=<secret>`. If INGEST_SECRET is unset, the routes are disabled (403)
// rather than open, so a deployed app cannot be triggered by strangers.

import { readEnv } from '../env'

export function checkIngestAuth(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = readEnv().INGEST_SECRET
  if (!secret) {
    return { ok: false, status: 403, error: 'ingest disabled: set INGEST_SECRET to enable' }
  }
  const url = new URL(request.url)
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const provided = bearer || url.searchParams.get('secret') || ''
  if (provided !== secret) {
    return { ok: false, status: 401, error: 'invalid ingest secret' }
  }
  return { ok: true }
}
