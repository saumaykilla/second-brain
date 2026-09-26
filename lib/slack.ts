// Slack proactive warnings (f-b-05).
//
// When an intent in Slack matches a dead end, ProjectBrain replies in the thread
// with the past attempt, blocker, evidence, alternative, and hours saved (R13,
// R29, F2). A non-matching message posts nothing (R14). Each posted warning is
// recorded in `warnings`; a "Not relevant" action is stored as feedback (R15).
//
// The Slack transport is injectable (SlackClient) so the handler is testable
// with a mocked client and no network — this is exactly what f-b-05 verifies.

import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { checkDeadEnds } from './contracts'
import { getActiveHarness } from './contracts/get-active-harness'
import { collection, isDbConfigured } from './db'
import { labelByKeywords } from './contracts/ingest-message'
import type { DeadEndMatch, Warning, Feedback } from './types'

export interface SlackClient {
  postMessage(args: { channel: string; thread_ts: string; text: string }): Promise<{ ts: string }>
}

/** Verify Slack's v0 request signature. */
export function verifySlackSignature(args: {
  signingSecret: string
  timestamp: string
  rawBody: string
  signature: string
  now?: number
}): boolean {
  const now = args.now ?? Math.floor(Date.now() / 1000)
  if (!args.timestamp || Math.abs(now - Number(args.timestamp)) > 60 * 5) return false
  const base = `v0:${args.timestamp}:${args.rawBody}`
  const expected = `v0=${createHmac('sha256', args.signingSecret).update(base).digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(args.signature)
  if (a.length !== b.length) return false
  return nodeTimingSafeEqual(a, b)
}

/** Format a dead-end match as a Slack thread reply (R13). */
export function formatWarning(match: DeadEndMatch): string {
  const attempt = match.attempt
  const blocker = attempt.blockers[0]
  const evidence = attempt.evidence?.[0] ?? blocker?.evidence?.[0]
  const lines = [
    `:warning: *Heads up — this looks like a dead end we already hit* (${Math.round(match.confidence * 100)}% match)`,
    `> *Tried:* ${attempt.approach}`,
    blocker ? `> *Why it failed (${blocker.type.replace('_', ' ')}):* ${blocker.detail}` : '',
    evidence ? `> *Evidence:* ${evidence.summary}${evidence.url ? ` — ${evidence.url}` : ''}` : '',
    attempt.alternative ? `> *What we did instead:* ${attempt.alternative}` : '',
    `> *Estimated hours saved:* ${match.hoursSaved}h`,
  ]
  return lines.filter(Boolean).join('\n')
}

export interface SlackMessageEvent {
  type: 'message'
  channel: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  subtype?: string
  bot_id?: string
}

export interface HandleResult {
  posted: boolean
  warningId?: string
  confidence?: number
}

/**
 * Handle one Slack message event: if it states an intent that matches a dead
 * end, post a threaded warning and record it. Otherwise do nothing.
 */
export async function handleSlackMessage(args: {
  projectId: string
  event: SlackMessageEvent
  client: SlackClient
}): Promise<HandleResult> {
  const { event } = args
  // Ignore bot messages, edits, and empty text so we never loop on our own reply.
  if (!event.text || event.bot_id || event.subtype) return { posted: false }

  // Only act on intent-like messages (someone about to do something).
  const label = labelByKeywords(event.text)
  if (label !== 'intent' && label !== 'attempt_start') return { posted: false }

  const matches = await checkDeadEnds(args.projectId, event.text)
  if (matches.length === 0) return { posted: false }

  const top = matches[0]
  const text = formatWarning(top)
  const threadTs = event.thread_ts ?? event.ts
  await args.client.postMessage({ channel: event.channel, thread_ts: threadTs, text })

  const harness = await getActiveHarness(args.projectId)
  const warning: Warning = {
    _id: randomUUID(),
    projectId: args.projectId,
    attemptId: top.attempt._id,
    channel: 'slack',
    confidence: top.confidence,
    hoursSaved: top.hoursSaved,
    harnessVersion: harness.version,
    createdAt: new Date().toISOString(),
  }
  if (isDbConfigured()) {
    await (await collection('warnings')).insertOne(warning)
  }

  return { posted: true, warningId: warning._id, confidence: top.confidence }
}

/** Record a "Not relevant" action on a warning as feedback (R15). */
export async function recordWarningFeedback(args: {
  projectId: string
  warningId: string
  verdict: 'helpful' | 'not_relevant'
  note?: string
}): Promise<Feedback> {
  const feedback: Feedback = {
    _id: randomUUID(),
    projectId: args.projectId,
    target: { kind: 'warning', id: args.warningId },
    verdict: args.verdict,
    note: args.note,
    createdAt: new Date().toISOString(),
  }
  if (isDbConfigured()) {
    await (await collection('feedback')).insertOne(feedback)
  }
  return feedback
}
