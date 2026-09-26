import { randomUUID } from 'node:crypto'
import { collection, isDbConfigured } from '../db'
import type { IngestInput, IngestResult, Message, MessageLabel } from '../types'

// Owner: Capture lane (f-a-03). PLACEHOLDER: stores the message and labels it
// by keywords. f-a-03 replaces the body with classify, extract, merge, embed,
// and checkConditions; the signature stays the same.

const RULES: Array<[MessageLabel, RegExp]> = [
  ['decision', /\b(decision|decided|we will use|going with|moves? to)\b/i],
  ['attempt_result', /\b(tried|didn'?t work|failed|dropping|switching to|moving \w+ to|not shipping|hit \d+%)/i],
  ['attempt_start', /\b(starting on|trying|spike on|going to try)\b/i],
  ['intent', /\b(going to|about to|plan to|let'?s add|will add)\b/i],
  ['question', /\?\s*$/],
]

export function labelByKeywords(text: string): MessageLabel {
  const match = RULES.find(([, pattern]) => pattern.test(text))
  return match ? match[0] : 'noise'
}

export async function ingestMessage(input: IngestInput): Promise<IngestResult> {
  const label = labelByKeywords(input.text)
  const message: Message = {
    _id: randomUUID(),
    projectId: input.projectId,
    source: input.source,
    sourceId: input.sourceId,
    threadId: input.threadId,
    author: input.author,
    text: input.text,
    postedAt: input.postedAt ?? new Date().toISOString(),
    label,
  }

  let duplicate = false
  if (isDbConfigured()) {
    const messages = await collection('messages')
    const existing = await messages.findOne({ projectId: input.projectId, source: input.source, sourceId: input.sourceId })
    if (existing) {
      return { message: existing, label: existing.label ?? label, duplicate: true, attemptIds: [], decisionIds: [], transitions: [] }
    }
    await messages.insertOne(message)
  }

  return { message, label, duplicate, attemptIds: [], decisionIds: [], transitions: [] }
}
