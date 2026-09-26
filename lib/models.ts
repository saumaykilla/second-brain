// Model provider seams (f-b-01, f-b-03, f-b-07).
//
// The serve lane needs embeddings (for vector search) and a strong-model judge
// (to decide whether a new intent is truly the same dead end, R12). Real calls
// go to OpenAI (embeddings) and OpenRouter (judge/answer) using the routing in
// the active harness (R35). Those calls sit behind these functions so the code
// runs offline in tests: when no API key is set we use deterministic local
// fallbacks. The signatures never change; only the transport does.

import { readEnv } from './env'
import type { Attempt, HarnessConfig } from './types'

export const EMBEDDING_DIMENSIONS = 1536

// --- Embeddings ----------------------------------------------------------

/** Deterministic offline embedding: hashed bag-of-words, unit length. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1)
  for (const token of tokens) {
    let h = 0x811c9dc5
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    const seed = h >>> 0
    for (let j = 0; j < 3; j++) {
      const idx = (seed + j * 2654435761) % EMBEDDING_DIMENSIONS
      vec[idx] += ((seed >> j) & 1) === 0 ? 1 : -1
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

/**
 * Embed text for retrieval. Uses OpenAI when OPENAI_API_KEY is set, otherwise a
 * deterministic local embedding so retrieval works offline.
 */
export async function embed(text: string, harness?: HarnessConfig): Promise<number[]> {
  const key = readEnv().OPENAI_API_KEY
  if (!key) return localEmbed(text)
  const model = harness?.routing.embed ?? 'text-embedding-3-small'
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: text }),
  })
  if (!res.ok) throw new Error(`embedding failed: ${res.status}`)
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> }
  return data.data[0].embedding
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

// --- Judge ---------------------------------------------------------------

export interface JudgeVerdict {
  match: boolean
  confidence: number
  reason: string
  blockerStillApplies: boolean
}

/**
 * Decide whether the proposed plan is the SAME approach under the SAME
 * conditions as a candidate dead end (R12). Uses the strong model when
 * OPENROUTER_API_KEY is set, otherwise a deterministic local judge.
 */
export async function judgeDeadEnd(
  plan: string,
  candidate: Attempt,
  vectorScore: number,
  harness: HarnessConfig,
): Promise<JudgeVerdict> {
  const key = readEnv().OPENROUTER_API_KEY
  if (key) {
    try {
      return await judgeWithModel(plan, candidate, harness, key)
    } catch {
      // Fall through to the local judge on any transport error.
    }
  }
  return localJudge(plan, candidate, vectorScore)
}

async function judgeWithModel(
  plan: string,
  candidate: Attempt,
  harness: HarnessConfig,
  key: string,
): Promise<JudgeVerdict> {
  const system = harness.prompts.judge
  const user = JSON.stringify({
    plan,
    candidate: {
      goal: candidate.goal,
      approach: candidate.approach,
      blockers: candidate.blockers.map((b) => ({ type: b.type, detail: b.detail })),
      conditions: candidate.conditions.map((c) => ({ description: c.description, met: c.met })),
      alternative: candidate.alternative,
    },
    instructions:
      'Return strict JSON {"match":boolean,"confidence":number 0..1,"reason":string,"blockerStillApplies":boolean}. ' +
      'match=true only if the plan is the same approach under the same conditions. ' +
      'If a stated condition is now satisfied, set blockerStillApplies=false.',
  })
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: harness.routing.judge,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`judge failed: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  const parsed = JSON.parse(data.choices[0].message.content) as Partial<JudgeVerdict>
  return {
    match: Boolean(parsed.match),
    confidence: clamp01(Number(parsed.confidence ?? 0)),
    reason: String(parsed.reason ?? ''),
    blockerStillApplies: parsed.blockerStillApplies ?? true,
  }
}

const STOP = new Set(
  'a an and the to of for on in with so we our is it be get gets add use using from that this all everyone team our will'.split(
    ' ',
  ),
)

/** Light stemmer so "summarise/summaries/summarisation" collapse together. */
function stem(word: string): string {
  return word
    .replace(/(isation|ization)$/, 'ise')
    .replace(/(ise|ize)$/, 'ise')
    .replace(/(ing|ed|es|s)$/, '')
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem)
      .filter((w) => w.length > 2),
  )
}

/**
 * Deterministic judge for offline/test use. Combines lexical overlap with the
 * vector score, then requires enough shared meaningful terms so an unrelated
 * plan is rejected even if a vector score happens to be high (R14).
 *
 * Importantly, the candidate's `alternative` is NOT counted: proposing the
 * alternative (e.g. SSE, Atlas Search) is the RIGHT move, not the dead end, so a
 * plan that names the alternative must not warn.
 */
export function localJudge(plan: string, candidate: Attempt, vectorScore: number): JudgeVerdict {
  const planTokens = tokens(plan)
  const candTokens = tokens(`${candidate.goal} ${candidate.approach}`)
  // Distinctive terms of the failed approach (drop the shared goal words so the
  // match is driven by the APPROACH, not the topic).
  const goalTokens = tokens(candidate.goal)
  const approachTokens = new Set([...candTokens].filter((t) => !goalTokens.has(t)))

  const shared = [...planTokens].filter((t) => candTokens.has(t))
  const approachShared = [...planTokens].filter((t) => approachTokens.has(t))

  // If the plan names the alternative, it is proposing the fix, not the dead end.
  const altTokens = tokens(candidate.alternative ?? '')
  const namesAlternative =
    altTokens.size > 0 && [...altTokens].filter((t) => planTokens.has(t)).length >= Math.min(2, altTokens.size)

  const overlap = shared.length
  const lexical = Math.min(1, overlap / 4)
  const combined = 0.5 * lexical + 0.5 * Math.max(0, vectorScore)
  // Require overlap on the distinctive approach terms, not just the topic.
  const match = !namesAlternative && approachShared.length >= 1 && overlap >= 3 && combined >= 0.4

  const blockerStillApplies = !candidate.conditions.some((c) => c.met)

  return {
    match,
    confidence: match ? Math.min(0.95, 0.6 + overlap * 0.08) : Math.min(0.35, combined),
    reason: match
      ? `Same approach as a past ${candidate.outcome} attempt (shared: ${shared.slice(0, 6).join(', ')}).`
      : namesAlternative
        ? `Proposes the alternative (${candidate.alternative}), not the dead end.`
        : `Different enough from "${candidate.approach}" to not warn.`,
    blockerStillApplies,
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
}
