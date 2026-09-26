// Cited answers (f-b-03, f-a-10).
//
// Answers a project question by retrieving relevant decisions and attempts and
// the connected Notion pages and GitHub files, then citing them. A superseded
// decision is never presented as the current one (R16, R17): the answer
// follows the supersededBy chain to the active decision and marks older ones
// as superseded. Uses the strong model when configured, else a deterministic
// composed answer so it runs offline. Nothing is invented when no record
// supports the question (R14).

import { collection, isDbConfigured } from './db'
import { readEnv } from './env'
import { getActiveHarness } from './contracts/get-active-harness'
import { retrieveAttempts, retrieveDecisions, retrieveDocuments } from './retrieval'
import { getFixture } from './fixtures'
import type { Attempt, Decision, HarnessConfig, KnowledgeDoc } from './types'

// Used only when no active harness exists (no DB and no fixture harness) so
// retrieval/compose still have valid settings instead of crashing.
const FALLBACK_HARNESS: HarnessConfig = {
  _id: 'fallback',
  projectId: 'fallback',
  version: 0,
  active: false,
  prompts: {
    classify: '',
    extract: '',
    judge: '',
    answer: 'Answer only from the cited records. Never present a superseded decision as current.',
    conditions: '',
  },
  retrieval: { k: 8, minScore: 0.72, hybridWeight: 0.3 },
  mergeWindowDays: 7,
  routing: {
    classify: 'openai/gpt-4o-mini',
    extract: 'openai/gpt-4o-mini',
    judge: 'openai/gpt-4o',
    reflect: 'openai/gpt-4o',
    embed: 'text-embedding-3-small',
  },
  createdAt: new Date(0).toISOString(),
}

export interface Citation {
  kind: 'attempt' | 'decision' | 'document'
  id: string
  title: string
  status: string
  supersededBy?: string
  /** For document citations: the source system and a link. */
  source?: string
  url?: string
}

export interface AnswerResult {
  projectId: string
  answer: string
  citations: Citation[]
  /** True when we found no supporting records and did not invent one (R14). */
  unsupported: boolean
}

const SOURCE_HITS = 5
const EXCERPT_CHARS = 280

/** Follow the supersededBy chain to the current decision (R17). */
export function resolveCurrent(decisions: Decision[], start: Decision): Decision {
  const byId = new Map(decisions.map((d) => [d._id, d]))
  let cur = start
  const seen = new Set<string>()
  while (cur.supersededBy && byId.has(cur.supersededBy) && !seen.has(cur._id)) {
    seen.add(cur._id)
    cur = byId.get(cur.supersededBy)!
  }
  return cur
}

async function safe<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work
  } catch {
    return fallback
  }
}

export function excerptOf(text: string, question: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= EXCERPT_CHARS) return clean
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3)
  const lower = clean.toLowerCase()
  let at = -1
  for (const term of terms) {
    at = lower.indexOf(term)
    if (at >= 0) break
  }
  const start = Math.max(0, Math.min(at < 0 ? 0 : at - 80, clean.length - EXCERPT_CHARS))
  const slice = clean.slice(start, start + EXCERPT_CHARS).trim()
  return `${start > 0 ? '…' : ''}${slice}${start + EXCERPT_CHARS < clean.length ? '…' : ''}`
}

export async function answerQuestion(projectId: string, question: string): Promise<AnswerResult> {
  let harness: HarnessConfig
  try {
    harness = await getActiveHarness(projectId)
  } catch {
    harness = FALLBACK_HARNESS
  }
  // Decisions for the supersededBy chain: the database when configured, the
  // fixture only offline.
  const allDecisions: Decision[] = isDbConfigured()
    ? await safe(
        collection('decisions').then((c) => c.find({ projectId }).toArray() as Promise<Decision[]>),
        [] as Decision[],
      )
    : (getFixture(projectId)?.decisions ?? [])

  const [decisionHits, attemptHits, docHits] = await Promise.all([
    retrieveDecisions(projectId, question, harness),
    retrieveAttempts(projectId, question, harness),
    retrieveDocuments(projectId, question, harness, { limit: 4 }),
  ])

  const topDecisions = decisionHits.slice(0, 3).map((h) => h.doc)
  const topAttempts = attemptHits.slice(0, 2).map((h) => h.doc)
  const topDocs = docHits.slice(0, 4).map((h) => h.doc)

  if (topDecisions.length === 0 && topAttempts.length === 0 && topDocs.length === 0) {
    return {
      projectId,
      answer: 'I could not find a decision, attempt, or document in this project that answers that.',
      citations: [],
      unsupported: true,
    }
  }

  const citations: Citation[] = []
  for (const d of topDecisions) {
    // If a retrieved decision is superseded, cite the CURRENT one instead (R17).
    const current = resolveCurrent(allDecisions, d)
    if (!citations.some((c) => c.id === current._id)) {
      citations.push({ kind: 'decision', id: current._id, title: current.title, status: current.status })
    }
    if (current._id !== d._id) {
      citations.push({ kind: 'decision', id: d._id, title: d.title, status: 'superseded', supersededBy: current._id })
    }
  }
  for (const a of topAttempts) {
    citations.push({ kind: 'attempt', id: a._id, title: a.approach, status: a.status })
  }
  for (const doc of topDocs) {
    citations.push({ kind: 'document', id: doc._id, title: doc.title, status: doc.kind, source: doc.source, url: doc.url })
  }

  const currentDecisions = topDecisions.map((d) => resolveCurrent(allDecisions, d))
  const key = readEnv().OPENROUTER_API_KEY
  const answer = key
    ? await composeWithModel(question, topDecisions.map((d) => resolveCurrent(allDecisions, d)), topAttempts, topDocs, harness, key)
    : composeLocally(question, topDecisions.map((d) => resolveCurrent(allDecisions, d)), topAttempts, topDocs)

  return { projectId, answer, citations, unsupported: false }
}

function composeLocally(_question: string, decisions: Decision[], attempts: Attempt[], docs: KnowledgeDoc[]): string {
  const parts: string[] = []
  const current = decisions.find((d) => d.status === 'active') ?? decisions[0]
  if (current) {
    parts.push(`Current decision: ${current.title}. ${current.rationale}`)
  }
  for (const a of attempts) {
    const blocker = a.blockers[0]
    parts.push(
      `The team ${a.outcome} "${a.approach}"${blocker ? ` (${blocker.type}: ${blocker.detail})` : ''}` +
        `${a.alternative ? `, and chose ${a.alternative} instead` : ''}.`,
    )
  }
  if (docs.length) {
    parts.push(
      `Related knowledge: ${docs.map((d) => `${d.title} (${d.source})`).slice(0, 3).join('; ')}.`,
    )
  }
  return parts.join(' ')
}

async function composeWithModel(
  question: string,
  decisions: Decision[],
  attempts: Attempt[],
  docs: KnowledgeDoc[],
  harness: { routing: { answer?: string; judge: string }; prompts: { answer: string } },
  key: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: harness.routing.answer ?? harness.routing.judge,
      messages: [
        { role: 'system', content: harness.prompts.answer },
        {
          role: 'user',
          content: JSON.stringify({
            question,
            decisions: decisions.map((d) => ({ id: d._id, title: d.title, rationale: d.rationale, status: d.status })),
            attempts: attempts.map((a) => ({ id: a._id, approach: a.approach, outcome: a.outcome, alternative: a.alternative })),
            documents: docs.map((d) => ({ id: d._id, title: d.title, source: d.source, text: d.text.slice(0, 800) })),
            instructions:
              'Answer concisely and cite decision/attempt/document ids. Use the documents for supporting context. Never present a superseded decision as current.',
          }),
        },
      ],
      temperature: 0,
    }),
  })
  if (!res.ok) throw new Error(`answer failed: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}
