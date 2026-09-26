// Structured extraction (f-a-02). The model fills a zod schema derived from
// lib/types.ts: typed blockers (the seven R3 types), evidence, conditions,
// alternative, hours, entities, and the decision a new decision replaces.
// Offline it falls back to a heuristic so tests run without a key.

import { z } from 'zod'
import type { HarnessConfig, MessageLabel } from '../types'
import { chat, modelConfigured, parseJsonObject } from './model'

const BLOCKER_TYPES = ['technical_limit', 'cost', 'performance', 'library_bug', 'licensing', 'org_constraint', 'time'] as const
const EVIDENCE_KINDS = ['log', 'benchmark', 'pr', 'commit', 'slack_thread'] as const
const OUTCOMES = ['failed', 'partially_worked', 'abandoned'] as const

const str = z.string().trim()
const optStr = z.string().trim().optional().nullable().transform((v) => (v ? v : undefined))

export const AttemptExtraction = z.object({
  goal: str.min(1),
  approach: str.min(1),
  outcome: z.enum(OUTCOMES).catch('failed'),
  blockers: z
    .array(z.object({ type: z.enum(BLOCKER_TYPES).catch('technical_limit'), detail: str.min(1) }))
    .catch([]),
  evidence: z
    .array(z.object({ kind: z.enum(EVIDENCE_KINDS).catch('slack_thread'), summary: str.min(1), url: optStr }))
    .catch([]),
  conditions: z.array(z.object({ description: str.min(1) })).catch([]),
  alternative: optStr,
  hoursSpent: z.coerce.number().min(0).catch(0),
  entities: z.array(str.min(1)).catch([]),
})

export const DecisionExtraction = z.object({
  title: str.min(1).max(120),
  rationale: str.min(1),
  replaces: optStr,
  entities: z.array(str.min(1)).catch([]),
})

export type AttemptDraft = z.infer<typeof AttemptExtraction>
export type DecisionDraft = z.infer<typeof DecisionExtraction>

export type Extraction = { kind: 'attempt'; attempt: AttemptDraft } | { kind: 'decision'; decision: DecisionDraft }

const ATTEMPT_SHAPE =
  '{"goal":string,"approach":string,"outcome":"failed"|"partially_worked"|"abandoned",' +
  '"blockers":[{"type":"technical_limit"|"cost"|"performance"|"library_bug"|"licensing"|"org_constraint"|"time","detail":string}],' +
  '"evidence":[{"kind":"log"|"benchmark"|"pr"|"commit"|"slack_thread","summary":string,"url":string|null}],' +
  '"conditions":[{"description":string}],"alternative":string|null,"hoursSpent":number,"entities":[string]}'
const DECISION_SHAPE = '{"title":string,"rationale":string,"replaces":string|null,"entities":[string]}'

export async function extractRecord(
  text: string,
  label: MessageLabel,
  harness: HarnessConfig,
  context: string[] = [],
): Promise<Extraction | null> {
  if (label !== 'decision' && label !== 'attempt_result') return null
  const kind = label === 'decision' ? 'decision' : 'attempt'
  if (modelConfigured()) {
    try {
      const shape = kind === 'attempt' ? ATTEMPT_SHAPE : DECISION_SHAPE
      const reply = await chat(
        harness.routing.extract,
        `${harness.prompts.extract}\nReturn strict JSON matching ${shape}. ` +
          'hoursSpent is the working time spent; count a day as 8 hours and use 0 when nothing is stated. entities are the technologies, services, or features named. ' +
          (kind === 'decision'
            ? 'replaces is the earlier approach or decision this one replaces, or null.'
            : 'alternative is what the team did or plans to do instead, or null. conditions are what would have to change for this approach to work.'),
        JSON.stringify({ message: text, earlierMessagesInThread: context }),
        true,
      )
      const parsed = parseJsonObject(reply)
      return kind === 'attempt'
        ? { kind, attempt: AttemptExtraction.parse(parsed) }
        : { kind, decision: DecisionExtraction.parse(parsed) }
    } catch {
      // fall through to the heuristic
    }
  }
  return heuristicExtract(text, kind, context)
}

const BLOCKER_HINTS: Array<[RegExp, (typeof BLOCKER_TYPES)[number]]> = [
  [/licen[cs]e|agpl|gpl/i, 'licensing'],
  [/\b(cost|price|expensive|budget)\b/i, 'cost'],
  [/\b(slow|latency|p95|performance|timeout|accuracy|\d+%)\b/i, 'performance'],
  [/\b(bug|crash|exception|throws)\b/i, 'library_bug'],
  [/\b(serverless|lambda|freeze|not supported|unsupported|limit|drops?|hang up)\b/i, 'technical_limit'],
  [/\b(policy|compliance|security review)\b/i, 'org_constraint'],
  [/\b(deadline|no time|out of time)\b/i, 'time'],
]

export function hoursIn(text: string): number {
  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hours?|hrs?)/i)
  if (h) return Number(h[1])
  const d = text.match(/(\d+(?:\.\d+)?)\s*days?/i)
  if (d) return Number(d[1]) * 8
  return 0
}

function heuristicExtract(text: string, kind: 'attempt' | 'decision', context: string[]): Extraction {
  const entities = [...new Set((text.match(/\b[A-Z][A-Za-z0-9.+-]{2,}\b/g) ?? []).filter((w) => !/^(We|The|Tried|Decision|Moving|Dropping|Not|Lost|Starting|Going)$/.test(w)))]
  if (kind === 'decision') {
    return {
      kind,
      decision: DecisionExtraction.parse({
        title: text.replace(/^decision:\s*/i, '').split(/[.!\n]/)[0].slice(0, 120),
        rationale: text,
        replaces: /\b(instead of|replac(?:es|ing)|over)\s+([^.,]+)/i.exec(text)?.[2] ?? null,
        entities,
      }),
    }
  }
  const outcome = /\b(abandon|dropp?(?:ed|ing)|licen[cs]e|not shipping)\b/i.test(text) ? 'abandoned' : /\b(partial|sort of|kind of)\b/i.test(text) ? 'partially_worked' : 'failed'
  const alternative = /\b(?:[Mm]oving|[Mm]ove|[Ss]witch(?:ing)?|[Gg]o(?:ing)?)\s+(?:\w+\s+){0,2}to\s+([A-Z][^.,]+)/.exec(text)?.[1]?.trim() ?? null
  return {
    kind,
    attempt: AttemptExtraction.parse({
      goal: (context[0] ?? text).split(/[.!\n]/)[0].slice(0, 100),
      approach: text.split(/[.!\n]/)[0].slice(0, 160),
      outcome,
      blockers: [{ type: BLOCKER_HINTS.find(([re]) => re.test(text))?.[1] ?? 'technical_limit', detail: text }],
      evidence: /benchmark|attached|log|screenshot|pr\b/i.test(text) ? [{ kind: /benchmark/i.test(text) ? 'benchmark' : 'slack_thread', summary: text.slice(0, 140) }] : [],
      conditions: [],
      alternative,
      hoursSpent: hoursIn(text),
      entities,
    }),
  }
}
