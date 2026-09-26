import { readEnv } from '@/lib/env'
import { recordWarningFeedback, verifySlackSignature } from '@/lib/slack'

export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.DEFAULT_PROJECT_ID ?? 'orbit'

// Slack interactivity handler (f-b-05): the "Not relevant" button on a warning
// posts here as an application/x-www-form-urlencoded `payload=<json>`. We store
// the verdict as feedback (R15) so reflection can use it later.
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signingSecret = readEnv().SLACK_SIGNING_SECRET
  if (signingSecret) {
    const ok = verifySlackSignature({
      signingSecret,
      timestamp: request.headers.get('x-slack-request-timestamp') ?? '',
      rawBody,
      signature: request.headers.get('x-slack-signature') ?? '',
    })
    if (!ok) return Response.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const payloadRaw = params.get('payload')
  if (!payloadRaw) return Response.json({ ok: false, error: 'missing_payload' }, { status: 400 })

  let payload: { actions?: Array<{ action_id?: string; value?: string }> }
  try {
    payload = JSON.parse(payloadRaw)
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const action = payload.actions?.[0]
  if (action?.action_id === 'warning_not_relevant' && action.value) {
    const feedback = await recordWarningFeedback({
      projectId: PROJECT_ID,
      warningId: action.value,
      verdict: 'not_relevant',
    })
    return Response.json({ ok: true, feedbackId: feedback._id, text: 'Thanks — marked not relevant.' })
  }

  return Response.json({ ok: true })
}
