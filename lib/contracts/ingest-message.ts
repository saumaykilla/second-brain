import type { IngestInput, IngestResult, MessageLabel } from '../types'
import { classifyByRules } from '../ingest/classify'
import { runIngest } from '../ingest/pipeline'

// Owner: Capture lane (f-a-03). Real implementation: classify with the harness
// small model, extract attempts and decisions, merge a start and result into
// one attempt, embed, link entities and edges, and run checkConditions for
// decisions. The signature is frozen (see docs/README).

/** Rule-based labels, used offline and as the fallback when no model key is set. */
export function labelByKeywords(text: string): MessageLabel {
  return classifyByRules(text)
}

export async function ingestMessage(input: IngestInput): Promise<IngestResult> {
  return runIngest(input)
}
