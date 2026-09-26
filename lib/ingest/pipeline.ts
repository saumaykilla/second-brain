// The ingest pipeline behind the ingestMessage contract (f-a-01..03).
//
// classify -> store message -> (decision | attempt_result) extract -> merge or
// insert -> embed -> link entities and edges -> checkConditions for decisions.
// Every step writes a trace. Replaying a message is a no-op. Nothing here reads
// the sample fixture; with no database the message is only classified.

import { randomUUID } from 'node:crypto'
import { collection, isDbConfigured } from '../db'
import { checkConditions } from '../contracts/check-conditions'
import { getActiveHarness } from '../contracts/get-active-harness'
import { cosineSimilarity, embed, embeddingProvider, localEmbed } from '../models'
import type { Attempt, Blocker, ConditionTransition, Decision, Edge, Entity, Evidence, HarnessConfig, IngestInput, IngestResult, Message } from '../types'
import { classifyMessage } from './classify'
import { extractRecord, type AttemptDraft, type DecisionDraft } from './extract'
import { overlap, tokens } from './text'

async function trace(projectId: string, messageId: string, step: string, detail: Record<string, unknown>): Promise<void> {
  await (await collection('traces')).insertOne({ projectId, messageId, step, detail, at: new Date().toISOString() })
}

async function safeEmbed(text: string): Promise<number[]> {
  try {
    return await embed(text)
  } catch {
    return localEmbed(text)
  }
}

async function upsertEntities(projectId: string, names: string[]): Promise<string[]> {
  const entities = await collection('entities')
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const existing = await entities.findOne({ projectId, name })
    if (existing) {
      ids.push(existing._id)
      continue
    }
    const entity: Entity = { _id: randomUUID(), projectId, name, kind: 'technology' }
    try {
      await entities.insertOne(entity)
      ids.push(entity._id)
    } catch {
      const raced = await entities.findOne({ projectId, name })
      if (raced) ids.push(raced._id)
    }
  }
  return ids
}

async function addEdge(projectId: string, kind: Edge['kind'], from: Edge['from'], to: Edge['to'], explanation: string): Promise<void> {
  const edges = await collection('edges')
  const existing = await edges.findOne({ projectId, kind, 'from.id': from.id, 'to.id': to.id })
  if (existing) return
  await edges.insertOne({ _id: randomUUID(), projectId, kind, from, to, explanation })
}

function windowStart(harness: HarnessConfig, at: string): string {
  const days = harness.mergeWindowDays || 7
  return new Date(new Date(at).getTime() - days * 86_400_000).toISOString()
}

/** Earlier messages in the same thread, or by the same author inside the merge window. */
async function threadContext(message: Message, harness: HarnessConfig): Promise<Message[]> {
  const messages = await collection('messages')
  const since = windowStart(harness, message.postedAt)
  return messages
    .find({
      projectId: message.projectId,
      _id: { $ne: message._id },
      postedAt: { $lte: message.postedAt, $gte: since },
      $or: [{ threadId: message.threadId }, { author: message.author }],
    })
    .sort({ postedAt: -1 })
    .limit(6)
    .toArray()
}

async function mergeAttempt(
  message: Message,
  context: Message[],
  draft: AttemptDraft,
  entityIds: string[],
  harness: HarnessConfig,
): Promise<{ attempt: Attempt; merged: boolean }> {
  const attempts = await collection('attempts')
  const evidence: Evidence[] = draft.evidence.map((e) => ({ kind: e.kind, summary: e.summary, url: e.url }))
  const blockers: Blocker[] = draft.blockers.map((b, i) => ({ type: b.type, detail: b.detail, evidence: i === 0 ? evidence : [] }))
  const text = `${draft.goal} ${draft.approach}`
  const embedding = await safeEmbed(text)
  const provider = embeddingProvider()
  const contextIds = context.map((m) => m._id)

  const candidates = (await attempts
    .find({
      projectId: message.projectId,
      status: 'active',
      startedAt: { $gte: windowStart(harness, message.postedAt) },
      $or: [{ sourceMessageIds: { $in: contextIds } }, { authors: message.author }],
    })
    .toArray()) as Array<Attempt & { embeddingProvider?: string }>

  let best: (typeof candidates)[number] | null = null
  let bestScore = 0
  const newTokens = tokens(text)
  for (const candidate of candidates) {
    const sameThread = candidate.sourceMessageIds.some((id) => contextIds.includes(id))
    const vector =
      candidate.embedding && candidate.embeddingProvider === provider
        ? cosineSimilarity(embedding, candidate.embedding)
        : cosineSimilarity(localEmbed(text), localEmbed(`${candidate.goal} ${candidate.approach}`))
    const lexical = overlap(newTokens, tokens(`${candidate.goal} ${candidate.approach}`))
    const score = sameThread ? Math.max(vector, 0.6) + lexical * 0.05 : vector + lexical * 0.05
    const threshold = provider === 'local' ? 0.35 : 0.6
    if (score >= threshold && score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  const startedAt = context.length ? context[context.length - 1].postedAt : message.postedAt
  if (best) {
    const merged: Attempt = {
      ...best,
      goal: best.goal || draft.goal,
      approach: draft.approach.length > best.approach.length ? draft.approach : best.approach,
      outcome: draft.outcome,
      blockers: [...best.blockers, ...blockers.filter((b) => !best!.blockers.some((x) => x.detail === b.detail))],
      evidence: [...best.evidence, ...evidence.filter((e) => !best!.evidence.some((x) => x.summary === e.summary))],
      conditions: [...best.conditions, ...draft.conditions.filter((c) => !best!.conditions.some((x) => x.description === c.description)).map((c) => ({ description: c.description, met: false }))],
      alternative: draft.alternative ?? best.alternative,
      hoursSpent: best.hoursSpent + draft.hoursSpent,
      authors: [...new Set([...best.authors, message.author])],
      sourceMessageIds: [...new Set([...best.sourceMessageIds, message._id])],
      entityIds: [...new Set([...best.entityIds, ...entityIds])],
      endedAt: message.postedAt,
      embedding,
    }
    const { _id, ...rest } = merged
    await attempts.replaceOne({ _id }, { ...rest, embeddingProvider: provider } as unknown as Attempt)
    return { attempt: merged, merged: true }
  }

  const attempt: Attempt = {
    _id: randomUUID(),
    projectId: message.projectId,
    goal: draft.goal,
    approach: draft.approach,
    outcome: draft.outcome,
    blockers,
    evidence,
    conditions: draft.conditions.map((c) => ({ description: c.description, met: false })),
    alternative: draft.alternative,
    hoursSpent: draft.hoursSpent,
    authors: [...new Set([message.author, ...context.map((m) => m.author)])],
    sourceMessageIds: [...new Set([...contextIds.filter((_, i) => context[i].threadId === message.threadId), message._id])],
    entityIds,
    status: 'active',
    startedAt,
    endedAt: message.postedAt,
    embedding,
  }
  await attempts.insertOne({ ...attempt, embeddingProvider: provider } as unknown as Attempt)
  return { attempt, merged: false }
}

async function linkAlternative(attempt: Attempt): Promise<void> {
  if (!attempt.alternative) return
  const decisions = (await (await collection('decisions')).find({ projectId: attempt.projectId, status: 'active' }).toArray()) as Decision[]
  const alt = tokens(attempt.alternative)
  const match = decisions.find((d) => overlap(alt, tokens(d.title)) >= 1)
  if (match) {
    await addEdge(attempt.projectId, 'alternative_to', { kind: 'decision', id: match._id }, { kind: 'attempt', id: attempt._id }, `${match.title} is what the team did instead of ${attempt.approach}.`)
  }
}

async function storeDecision(message: Message, draft: DecisionDraft, entityIds: string[]): Promise<{ decision: Decision; superseded: string[] }> {
  const decisions = await collection('decisions')
  const text = `${draft.title} ${draft.rationale}`
  const embedding = await safeEmbed(text)
  const provider = embeddingProvider()
  const decision: Decision = {
    _id: randomUUID(),
    projectId: message.projectId,
    title: draft.title,
    rationale: draft.rationale,
    status: 'active',
    authors: [message.author],
    sourceMessageIds: [message._id],
    entityIds,
    decidedAt: message.postedAt,
    embedding,
  }
  await decisions.insertOne({ ...decision, embeddingProvider: provider } as unknown as Decision)

  const active = (await decisions.find({ projectId: message.projectId, status: 'active', _id: { $ne: decision._id } }).toArray()) as Array<Decision & { embeddingProvider?: string }>
  const superseded: string[] = []
  const replaces = draft.replaces ? tokens(draft.replaces) : new Set<string>()
  const titleTokens = tokens(draft.title)
  for (const old of active) {
    const oldTokens = tokens(`${old.title} ${old.rationale}`)
    const vector = old.embedding && old.embeddingProvider === provider ? cosineSimilarity(embedding, old.embedding) : 0
    const named = replaces.size > 0 && overlap(replaces, oldTokens) >= 1 && overlap(titleTokens, tokens(old.title)) >= 1
    if (named || vector >= 0.86) {
      await decisions.updateOne({ _id: old._id }, { $set: { status: 'superseded', supersededBy: decision._id } })
      await addEdge(message.projectId, 'superseded_by', { kind: 'decision', id: old._id }, { kind: 'decision', id: decision._id }, `${decision.title} replaces ${old.title}.`)
      superseded.push(old._id)
    }
  }
  return { decision, superseded }
}

export async function runIngest(input: IngestInput): Promise<IngestResult> {
  const harness = await getActiveHarness(input.projectId)
  const postedAt = input.postedAt ?? new Date().toISOString()
  const message: Message = {
    _id: randomUUID(),
    projectId: input.projectId,
    source: input.source,
    sourceId: input.sourceId,
    threadId: input.threadId,
    author: input.author,
    text: input.text,
    postedAt,
  }
  const empty = (label: Message['label'], duplicate = false): IngestResult => ({ message, label: label ?? 'noise', duplicate, attemptIds: [], decisionIds: [], transitions: [] })

  if (!isDbConfigured()) {
    const { label } = await classifyMessage(input.text, harness)
    message.label = label
    return empty(label)
  }

  const messages = await collection('messages')
  const existing = await messages.findOne({ projectId: input.projectId, source: input.source, sourceId: input.sourceId })
  if (existing) return { ...empty(existing.label ?? 'noise', true), message: existing }

  const { label, by } = await classifyMessage(input.text, harness)
  message.label = label
  await messages.insertOne(message)
  await trace(message.projectId, message._id, 'classify', { label, by, model: harness.routing.classify })

  if (label !== 'decision' && label !== 'attempt_result') {
    await trace(message.projectId, message._id, 'route', { stored: true, extracted: false, reason: `${label} goes no further` })
    return empty(label)
  }

  const context = await threadContext(message, harness)
  const extraction = await extractRecord(input.text, label, harness, context.map((m) => m.text))
  await trace(message.projectId, message._id, 'extract', { kind: extraction?.kind ?? null, contextMessages: context.length, model: harness.routing.extract })
  if (!extraction) return empty(label)

  const entityIds = await upsertEntities(message.projectId, extraction.kind === 'attempt' ? extraction.attempt.entities : extraction.decision.entities)

  if (extraction.kind === 'attempt') {
    const { attempt, merged } = await mergeAttempt(message, context, extraction.attempt, entityIds, harness)
    await linkAlternative(attempt)
    await trace(message.projectId, message._id, merged ? 'merge' : 'store', { attemptId: attempt._id, outcome: attempt.outcome, hoursSpent: attempt.hoursSpent, embedded: Boolean(attempt.embedding) })
    return { ...empty(label), attemptIds: [attempt._id] }
  }

  const { decision, superseded } = await storeDecision(message, extraction.decision, entityIds)
  await trace(message.projectId, message._id, 'store', { decisionId: decision._id, superseded, embedded: Boolean(decision.embedding) })
  let transitions: ConditionTransition[] = []
  try {
    // checkConditions marks met conditions, flips the attempt to revisitable, and adds the unblocks edge.
    transitions = await checkConditions(message.projectId, decision._id)
  } catch {
    transitions = []
  }
  await trace(message.projectId, message._id, 'conditions', { transitions: transitions.length })
  return { ...empty(label), decisionIds: [decision._id], transitions }
}
