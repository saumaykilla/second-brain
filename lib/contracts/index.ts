// The only surface one lane may call in the other before a checkpoint.
// Signatures are frozen; see docs/README.md "Contracts between lanes".
export { ingestMessage } from './ingest-message'
export { checkDeadEnds } from './check-dead-ends'
export { checkConditions } from './check-conditions'
export { getActiveHarness } from './get-active-harness'
