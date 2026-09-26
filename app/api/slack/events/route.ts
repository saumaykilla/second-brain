import { readEnv } from '@/lib/env'
import { handleSlackMessage, verifySlackSignature, type SlackClient, type SlackMessageEvent } from '@/lib/slack'

export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.DEFAULT_PROJECT_ID?.trim() || 'default'

// Slack Web API client using the bot token (f-b-05). Falls back to a no-op when
// no token is configured so local/dev events do not fail.
function makeSlackClient(): SlackClient {
  const token = readEnv().SLACK_BOT_TOKEN
  return {
    async postMessage({ channel, thread_ts, text }) {
      if (!token) return { ts: 'noop' }
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, thread_ts, text }),
      })
      const data = (await res.json()) as { ok: boolean; ts?: string; error?: string }
      if (!data.ok) throw new Error(`slack post failed: ${data.error}`)
      return { ts: data.ts ?? '' }
    },
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signingSecret = readEnv().SLACK_SIGNING_SECRET

  // Parse first so we can answer the url_verification challenge even before a
  // secret is configured in a fresh workspace.
  let body: {
    type?: string
    challenge?: string
    event?: SlackMessageEvent
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge })
  }

  // Verify the signature for real events.
  if (signingSecret) {
    const ok = verifySlackSignature({
      signingSecret,
      timestamp: request.headers.get('x-slack-request-timestamp') ?? '',
      rawBody,
      signature: request.headers.get('x-slack-signature') ?? '',
    })
    if (!ok) return Response.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }

  if (body.event?.type === 'message') {
    const result = await handleSlackMessage({
      projectId: PROJECT_ID,
      event: body.event,
      client: makeSlackClient(),
    })
    return Response.json({ ok: true, ...result })
  }

  return Response.json({ ok: true })
}
