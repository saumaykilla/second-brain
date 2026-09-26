// Eval set for Orbit (f-b-06, R20).
//
// 40 cases: 15 dead-end checks (incl. 5 tricky non-matches that must NOT warn),
// 15 decision-recall questions, and 10 condition-met cases. These measure
// whether recall is good enough to trust a warning (R21) and gate reflection
// promotion (R22).

export type EvalCaseType = 'dead_end' | 'decision_recall' | 'condition_met'

export interface EvalCase {
  id: string
  type: EvalCaseType
  input: string
  /** For dead_end: attempt ids that SHOULD match ([] for a tricky non-match). */
  expectedAttemptIds?: string[]
  /** For decision_recall: decision ids the answer should cite. */
  expectedDecisionIds?: string[]
  /** For condition_met: the decision that unblocks, and the attempt it reopens. */
  decisionId?: string
  expectedReopens?: string[]
  /** Marks the 5 tricky non-matches among dead-end cases. */
  trickyNonMatch?: boolean
}

// --- 15 dead-end cases (10 true matches + 5 tricky non-matches) ----------
const deadEnd: EvalCase[] = [
  { id: 'de-1', type: 'dead_end', input: 'Add socket.io so the task board shows live updates for the whole team.', expectedAttemptIds: ['att-websockets'] },
  { id: 'de-2', type: 'dead_end', input: 'Let us put a WebSocket server on our serverless functions for realtime.', expectedAttemptIds: ['att-websockets'] },
  { id: 'de-3', type: 'dead_end', input: 'Use Postgres LIKE queries to search task titles and descriptions.', expectedAttemptIds: ['att-postgres-like'] },
  { id: 'de-4', type: 'dead_end', input: 'Do full-text search over tasks with SQL LIKE wildcards.', expectedAttemptIds: ['att-postgres-like'] },
  { id: 'de-5', type: 'dead_end', input: 'Render task board exports to PDF with an AGPL-licensed library.', expectedAttemptIds: ['att-pdf-library'] },
  { id: 'de-6', type: 'dead_end', input: 'Generate ticket summaries with the cheapest available language model.', expectedAttemptIds: ['att-cheap-summary'] },
  { id: 'de-7', type: 'dead_end', input: 'Stream live task updates over WebSockets from a Lambda function.', expectedAttemptIds: ['att-websockets'] },
  { id: 'de-8', type: 'dead_end', input: 'Search tasks by matching substrings with Postgres ILIKE.', expectedAttemptIds: ['att-postgres-like'] },
  { id: 'de-9', type: 'dead_end', input: 'Export boards to PDF using that AGPL rendering library we found.', expectedAttemptIds: ['att-pdf-library'] },
  { id: 'de-10', type: 'dead_end', input: 'Summarise support tickets automatically with the cheap model to save cost.', expectedAttemptIds: ['att-cheap-summary'] },
  // Tricky non-matches: share words / topic but are a DIFFERENT approach (R14).
  { id: 'de-11', type: 'dead_end', input: 'Add Server-Sent Events for one-way live task updates.', expectedAttemptIds: [], trickyNonMatch: true },
  { id: 'de-12', type: 'dead_end', input: 'Use MongoDB Atlas Search for full-text task search.', expectedAttemptIds: [], trickyNonMatch: true },
  { id: 'de-13', type: 'dead_end', input: 'Add CSV export for invoices from the billing page.', expectedAttemptIds: [], trickyNonMatch: true },
  { id: 'de-14', type: 'dead_end', input: 'Summarise tickets with a strong model behind a nightly batch job.', expectedAttemptIds: [], trickyNonMatch: true },
  { id: 'de-15', type: 'dead_end', input: 'Add a dark mode toggle to the settings screen.', expectedAttemptIds: [], trickyNonMatch: true },
]

// --- 15 decision-recall cases -------------------------------------------
const decisionRecall: EvalCase[] = [
  { id: 'dr-1', type: 'decision_recall', input: 'What authentication does Orbit use now?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-2', type: 'decision_recall', input: 'Why did we stop using JWTs?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-3', type: 'decision_recall', input: 'How do we do realtime updates?', expectedDecisionIds: ['dec-sse'] },
  { id: 'dr-4', type: 'decision_recall', input: 'What did we choose for search after Postgres LIKE?', expectedDecisionIds: ['dec-atlas-search'] },
  { id: 'dr-5', type: 'decision_recall', input: 'Where does the realtime service run?', expectedDecisionIds: ['dec-app-runner'] },
  { id: 'dr-6', type: 'decision_recall', input: 'Are we still using server-side sessions?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-7', type: 'decision_recall', input: 'What is our current auth stack?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-8', type: 'decision_recall', input: 'Did we pick SSE or WebSockets for live updates?', expectedDecisionIds: ['dec-sse'] },
  { id: 'dr-9', type: 'decision_recall', input: 'What search technology powers task search?', expectedDecisionIds: ['dec-atlas-search'] },
  { id: 'dr-10', type: 'decision_recall', input: 'Why did we move realtime to App Runner?', expectedDecisionIds: ['dec-app-runner'] },
  { id: 'dr-11', type: 'decision_recall', input: 'What replaced JWT auth?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-12', type: 'decision_recall', input: 'How are live task-board updates delivered?', expectedDecisionIds: ['dec-sse'] },
  { id: 'dr-13', type: 'decision_recall', input: 'What is the decision on full-text search?', expectedDecisionIds: ['dec-atlas-search'] },
  { id: 'dr-14', type: 'decision_recall', input: 'Which auth library are we on today?', expectedDecisionIds: ['dec-better-auth'] },
  { id: 'dr-15', type: 'decision_recall', input: 'Where is the realtime workload hosted?', expectedDecisionIds: ['dec-app-runner'] },
]

// --- 10 condition-met cases ---------------------------------------------
const conditionMet: EvalCase[] = [
  { id: 'cm-1', type: 'condition_met', input: 'Move the realtime service to AWS App Runner.', decisionId: 'dec-app-runner', expectedReopens: ['att-websockets'] },
  { id: 'cm-2', type: 'condition_met', input: 'Adopt Better Auth for sessions.', decisionId: 'dec-better-auth', expectedReopens: [] },
  { id: 'cm-3', type: 'condition_met', input: 'Use Atlas Search for search.', decisionId: 'dec-atlas-search', expectedReopens: [] },
  { id: 'cm-4', type: 'condition_met', input: 'Use Server-Sent Events for updates.', decisionId: 'dec-sse', expectedReopens: [] },
  { id: 'cm-5', type: 'condition_met', input: 'Keep using serverless sessions.', decisionId: 'dec-sessions', expectedReopens: [] },
  { id: 'cm-6', type: 'condition_met', input: 'Switch auth to JWT.', decisionId: 'dec-jwt', expectedReopens: [] },
  { id: 'cm-7', type: 'condition_met', input: 'Run realtime on a long-running App Runner container.', decisionId: 'dec-app-runner', expectedReopens: ['att-websockets'] },
  { id: 'cm-8', type: 'condition_met', input: 'Choose Better Auth as the auth system.', decisionId: 'dec-better-auth', expectedReopens: [] },
  { id: 'cm-9', type: 'condition_met', input: 'Adopt SSE as the realtime transport.', decisionId: 'dec-sse', expectedReopens: [] },
  { id: 'cm-10', type: 'condition_met', input: 'Migrate the realtime service onto App Runner persistent compute.', decisionId: 'dec-app-runner', expectedReopens: ['att-websockets'] },
]

export const EVAL_SET: EvalCase[] = [...deadEnd, ...decisionRecall, ...conditionMet]

export const EVAL_COUNTS = {
  total: EVAL_SET.length,
  dead_end: deadEnd.length,
  tricky_non_matches: deadEnd.filter((c) => c.trickyNonMatch).length,
  decision_recall: decisionRecall.length,
  condition_met: conditionMet.length,
}
