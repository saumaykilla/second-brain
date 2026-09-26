# f-be-03 — Slack Capture and Proactive Warnings

## Goal

Capture Slack messages and warn in the same thread when a new intent matches a dead end.

## User-visible behavior

When someone says they are about to repeat a failed approach in Slack, ProjectBrain replies in that thread with the past dead end, evidence, alternative, and estimated hours saved.

## Scope / out of scope

In scope:

- `POST /api/slack/events` with Slack request verification.
- Ingesting message events through the capture pipeline.
- Running the dead-end check on intent messages.
- A threaded bot reply containing the match confidence, blocker, evidence pointer, alternative, and hours.
- A `warnings` record for every posted warning.
- A way to mark a warning not relevant, stored as feedback.

Out of scope:

- A general Slack chat product.
- GitHub pull-request comments.
- Live dependency on Slack during tests. Fixtures must be enough to verify the reply.

## Acceptance criteria

- A verified Slack message is stored and processed once.
- The socket.io live-updates intent against the Orbit WebSockets dead end produces a threaded warning with confidence, blocker, SSE alternative, and 14 hours.
- A non-matching message does not post a warning.
- Each warning is stored with whether it was helpful or not relevant, when that response exists.
- Invalid Slack signatures are rejected.

## Verification steps

1. Run Slack event signature and intent-classification tests.
2. Replay the socket.io intent fixture and verify a threaded warning with confidence, blocker, alternative, and hours.
3. Verify a non-matching message does not post a warning.
4. Record the warning in the warnings collection.
5. Verify a not-relevant action is stored as feedback.

## Dependencies

- `f-be-02` Dead-End Check.
- `f-db-02` Orbit Seed and Eval Set, for the demo fixture.

## Open questions

- Which Slack action or emoji should record "not relevant"?
- Should the bot reply only above a confidence cutoff, or also reply with a low-confidence aside?
