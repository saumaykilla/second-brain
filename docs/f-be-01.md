# f-be-01 — Capture and Extraction Pipeline

## Goal

Turn captured messages into structured attempts and decisions, and merge a later result into the attempt it belongs to.

## User-visible behavior

A captured Slack-style or web message becomes a structured decision or attempt. A later result in the same thread updates that attempt instead of creating a duplicate.

## Scope / out of scope

In scope:

- `POST /api/capture` for manual web capture.
- LangGraph nodes for classify, extract, merge attempt, embed and store, and link.
- Classification labels: `decision`, `attempt_start`, `attempt_result`, `intent`, `question`, and `noise`.
- Extraction through the active harness prompts, with OpenAI structured output.
- Cheap classification through OpenRouter according to the harness routing policy.
- Merging by thread, and by the same author inside a bounded number of days.
- Embeddings over goal, approach, and blockers together, stored on the attempt.
- Edges from an attempt to its entities and alternative decision.
- A trace for each pipeline node.

Out of scope:

- Proactive warnings, question answering, and condition re-checks.
- Slack signature verification and threaded replies.
- Reflection and eval promotion.

## Acceptance criteria

- An attempt-start message followed by a result in the same thread becomes one attempt with outcome, blockers, and evidence.
- A decision message becomes one decision and does not also become an attempt.
- Noise is stored as a message and creates neither an attempt nor a decision.
- Reprocessing the same source message does not duplicate the extracted record.
- The pipeline reads prompts from the active harness version.
- Each node records a trace that can be inspected when tracing is configured.

## Verification steps

1. Run unit tests for classification labels and the extraction schema.
2. Post a manual capture that starts an attempt and a later result in the same thread, and verify one attempt with outcome, blockers, and evidence.
3. Verify noise messages are stored but do not create attempts or decisions.
4. Verify embeddings are written on attempts and decisions.
5. Verify each pipeline node emits a trace.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-db-01` Memory Collections and Search Indexes.

## Open questions

- How many days should the same-author merge window cover?
- Which OpenRouter model names are the initial small and strong models?
