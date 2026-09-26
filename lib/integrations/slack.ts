// Slack integration: pull channel messages into the documents collection.
//
// Uses the Slack Web API with a bot token (SLACK_BOT_TOKEN) that has
// channels:history (and groups:history for private channels). Given channel IDs,
// it reads recent messages and stores each as a KnowledgeDoc. (Real-time events
// are handled separately by /api/slack/events for proactive warnings.)

import { readEnv } from '../env'
import { docId, ingestDocuments, normalizeText, type IngestReport, type RawDoc } from './ingest-docs'

const API = 'https://slack.com/api'

interface SlackMessage {
  type: string
  ts: string
  user?: string
  text?: string
  subtype?: string
  bot_id?: string
}

async function slackGet<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${API}/${method}?${qs}`, { headers: { authorization: `Bearer ${token}` } })
  const data = (await res.json()) as { ok: boolean; error?: string } & T
  if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error}`)
  return data
}

export async function ingestSlack(
  projectId: string,
  opts: { channels: string[]; perChannel?: number },
): Promise<IngestReport> {
  const token = readEnv().SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set.')
  if (!opts.channels?.length) throw new Error('Provide at least one channel id to ingest.')
  const perChannel = opts.perChannel ?? 200

  const raw: RawDoc[] = []
  for (const channel of opts.channels) {
    const data = await slackGet<{ messages?: SlackMessage[] }>(token, 'conversations.history', {
      channel,
      limit: String(Math.min(1000, perChannel)),
    })
    for (const m of data.messages ?? []) {
      // Skip bot messages, joins/leaves, and empty text.
      if (!m.text || m.bot_id || (m.subtype && m.subtype !== 'thread_broadcast')) continue
      raw.push({
        _id: docId(projectId, 'slack', `${channel}:${m.ts}`),
        projectId,
        source: 'slack',
        kind: 'message',
        sourceId: `${channel}:${m.ts}`,
        title: `Message in ${channel}`,
        text: normalizeText(m.text),
        author: m.user,
        tags: [channel],
        createdAt: new Date(Number(m.ts.split('.')[0]) * 1000).toISOString(),
      })
    }
  }
  return ingestDocuments(projectId, raw)
}
