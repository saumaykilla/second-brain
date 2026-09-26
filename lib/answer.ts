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
import { retrieveAttempts, retrieveDecisions } from './retrieval'
import { getFixture } from './fixtures'
import { searchSources, type SourceHit } from './sources/search'
import type { Attempt, Decision } from './types'

export interface Citation {
  kind: 'attempt' | 'decision' | 'doc'
  id: string
  title: string
  status: string
  supersededBy?: string
  /** Connected source citations open the page or file. */
  url?: string
  provider?: 'github' | 'notion'
  excerpt?: string
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
  let harness
  try {
    harness = await getActiveHarness(projectId)
  } catch {
    harness = undefined
  }
  // Decisions for the supersededBy chain: the database when configured, the
  // fixture only offline.
  const allDecisions: Decision[] = isDbConfigured()
    ? await safe(
        collection('decisions').then((c) => c.find({ projectId }).toArray() as Promise<Decision[]>),
        [] as Decision[],
      )
    : (getFixture(projectId)?.decisions ?? [])

  const [decisionHits, attemptHits, sourceHits] = await Promise.all([
    harness ? safe(retrieveDecisions(projectId, question, harness), []) : Promise.resolve([]),
    harness ? safe(retrieveAttempts(projectId, question, harness), []) : Promise.resolve([]),
    safe(searchSources(projectId, question, SOURCE_HITS), [] as SourceHit[]),
  ])

  const topDecisions = decisionHits.slice(0, 3).map((h) => h.doc)
  const topAttempts = attemptHits.slice(0, 2).map((h) => h.doc)

  if (topDecisions.length === 0 && topAttempts.length === 0 && sourceHits.length === 0) {
    return {
      projectId,
      answer: 'I could not find a decision, attempt, or connected page in this project that answers that.',
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
  const seenDocs = new Set<string>()
  for (const hit of sourceHits) {
    const key = `${hit.provider}:${hit.sourceId}:${hit.docId}`
    if (seenDocs.has(key)) continue
    seenDocs.add(key)
    citations.push({
      kind: 'doc',
      id: hit.id,
      title: hit.title,
      status: hit.provider,
      url: hit.url,
      provider: hit.provider,
      excerpt: excerptOf(hit.text, question),
    })
  }

  const currentDecisions = topDecisions.map((d) => resolveCurrent(allDecisions, d))
  const key = readEnv().OPENROUTER_API_KEY
  let answer: string
  if (key && harness) {
    try {
      answer = await composeWithModel(question, currentDecisions, topAttempts, sourceHits, harness, key)
    } catch {
      answer = composeLocally(question, currentDecisions, topAttempts, sourceHits)
    }
  } else {
    answer = composeLocally(question, currentDecisions, topAttempts, sourceHits)
  }

  return { projectId, answer, citations, unsupported: false }
}

function composeLocally(question: string, decisions: Decision[], attempts: Attempt[], sources: SourceHit[]): string {
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
  for (const hit of sources.slice(0, 2)) {
    parts.push(`From ${hit.title}: ${excerptOf(hit.text, question)}`)
  }
  return parts.join(' ')
}

async function composeWithModel(
  question: string,
  decisions: Decision[],
  attempts: Attempt[],
  sources: SourceHit[],
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
            sources: sources.map((s) => ({ id: s.id, title: s.title, provider: s.provider, url: s.url, text: s.text })),
            instructions:
              'Answer concisely using only the decisions, attempts, and sources given. Cite the ids or titles you used. ' +
              'Never present a superseded decision as current. If the material does not answer the question, say so.',
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
