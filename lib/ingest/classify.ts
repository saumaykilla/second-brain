// Message classification (f-a-01). Uses the harness classify prompt and the
// small model. Offline (no OPENROUTER_API_KEY) it uses the keyword rules so
// the pipeline still runs in tests.

import type { HarnessConfig, MessageLabel } from '../types'
import { chat, modelConfigured } from './model'

export const LABELS: MessageLabel[] = ['decision', 'attempt_start', 'attempt_result', 'intent', 'question', 'noise']

// A result of trying something outranks the decision words that often follow it
// ("tried X ... switching to Y" is an attempt result, not a decision).
const RULES: Array<[MessageLabel, RegExp]> = [
  ['question', /\?\s*$/],
  ['attempt_result', /\b(tried|didn'?t work|did not work|failed|gave up|dropping|dropped|abandon(?:ed|ing)?|not shipping|blocked|hit \d+%|too slow|couldn'?t|benchmark|p95|lost (?:about )?\d+)\b/i],
  ['decision', /\b(decision|decided|we will use|we'll use|going with|switch(?:ing)? to|adopt(?:ing)?|moves? .* to)\b/i],
  ['attempt_start', /\b(starting on|trying|spike on|going to try|prototyp|experiment)\b/i],
  ['intent', /\b(going to|about to|plan(?:ning)? to|let'?s add|will add|thinking of)\b/i],
]

export function classifyByRules(text: string): MessageLabel {
  const match = RULES.find(([, pattern]) => pattern.test(text))
  if (match) return match[0]
  return text.trim().length < 12 ? 'noise' : 'noise'
}

/** What each label means. Appended to the harness prompt so the small model applies one taxonomy. */
export const LABEL_GUIDE = [
  'attempt_result: reports the outcome of something the team tried (it failed, was dropped, partially worked, or was abandoned), even if the message also says what they will do instead.',
  'attempt_start: the team is starting or about to try a specific approach.',
  'decision: the team commits to an approach or tool, with no report of a prior failed try in the same message.',
  'intent: someone plans or proposes to do something but has not started.',
  'question: asks something.',
  'noise: none of the above.',
  'When a message both reports an outcome and names a replacement, the label is attempt_result.',
].join('\n')

export function parseLabel(reply: string): MessageLabel | null {
  const word = reply.toLowerCase().replace(/[^a-z_]/g, ' ').trim().split(/\s+/)[0]
  return (LABELS as string[]).includes(word) ? (word as MessageLabel) : null
}

export async function classifyMessage(text: string, harness: HarnessConfig): Promise<{ label: MessageLabel; by: 'model' | 'rules' }> {
  if (modelConfigured()) {
    try {
      const reply = await chat(
        harness.routing.classify,
        `${harness.prompts.classify}\nAllowed labels: ${LABELS.join(', ')}.\n${LABEL_GUIDE}`,
        text,
        false,
      )
      const label = parseLabel(reply)
      if (label) return { label, by: 'model' }
    } catch {
      // fall through to rules
    }
  }
  return { label: classifyByRules(text), by: 'rules' }
}
