# f-be-05 — Structured Meeting Records

## Goal

Convert completed meetings into durable, cited company memory without retaining raw meeting audio or video.

## User-visible behavior

After a meeting ends, participants can open its transcript, summary, decisions, action items, and citations; future retrieval can use the approved record.

## Scope / out of scope

In scope:

- Timestamped transcript finalization.
- Summary, key-decision, and action-item extraction.
- Source links from generated record items to transcript evidence and referenced company knowledge.
- Processing status, retry, failure, and partial-result handling.
- Search eligibility for completed meeting records.
- Raw media deletion after required processing.

Out of scope:

- Permanent audio or video recordings.
- Human transcription editing comparable to a document editor.
- Decision ownership workflows, reminders, and status management.
- Export formats beyond what the initial product requires.

## Acceptance criteria

- Ending a meeting creates one canonical processing job and does not duplicate records when events repeat.
- The record identifies its meeting, company, participants, and creation time.
- The transcript preserves speaker attribution and useful ordering.
- Summaries, decisions, and action items cite supporting transcript ranges or approved knowledge.
- Participants can distinguish processing, complete, partial, and failed states.
- Retriable failures can be retried without duplicating the canonical record.
- Raw audio and video are deleted after processing and are not exposed as permanent records.
- Only authorized company members can access the record.
- Eligible completed content becomes retrievable as prior meeting memory.

## Verification steps

1. Run transcript, extraction, citation, idempotency, authorization, and retry tests.
2. Complete a controlled multi-speaker meeting and compare the produced record with the known transcript.
3. Repeat the meeting-ended event and verify only one canonical record.
4. Force partial and failed processing states and verify recovery behavior.
5. Verify raw media deletion after processing.
6. Open the finished record in a browser and follow its transcript and knowledge citations.

## Dependencies

- `f-be-03` Meeting Scheduling and Lifecycle.
- `f-ui-02` LiveKit Meeting Room.
- `f-be-04` AI Meeting Memory and Citations.

## Open questions

- What transcript retention controls should administrators receive beyond raw-media deletion?
- Which action-item fields are required before the advanced decision system exists?
- What quality threshold permits a record to become searchable automatically?
