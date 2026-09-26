# f-be-04 — Cited Answers

## Goal

Answer project questions from stored decisions and attempts, with citations, without presenting superseded decisions as current.

## User-visible behavior

Asking why the team rejected an approach returns a concise answer that cites the attempt or decision. A superseded decision is not presented as the current one.

## Scope / out of scope

In scope:

- `POST /api/ask`.
- Retrieval over approved project attempts and decisions.
- Answers that cite record ids and titles.
- Staleness handling so superseded decisions are identified and are not returned as current.
- An explicit response when stored memory does not support an answer.
- `POST /api/feedback` for thumbs and corrections on an answer.

Out of scope:

- General web search.
- The chat screen. This feature supplies the API the screen will call.
- Rewriting harness prompts. Feedback is stored for the later reflection feature.

## Acceptance criteria

- A question about Postgres search cites the benchmark and the Atlas Search decision.
- A question about current authentication cites Better Auth and identifies JWT as superseded.
- An unsupported question does not invent a dead end.
- Citations resolve only to records in the asked project.
- Feedback is stored against the answer.

## Verification steps

1. Ask the Postgres search question against seeded Orbit data and verify the benchmark citation and the Atlas Search alternative.
2. Ask what authentication the team uses and verify Better Auth is current and JWT is marked superseded.
3. Verify an unsupported question does not invent a dead end.
4. Verify citations resolve to attempt and decision ids in the same project.
5. Post feedback on an answer and read it back.

## Dependencies

- `f-be-01` Capture and Extraction Pipeline.
- `f-db-02` Orbit Seed and Eval Set.

## Open questions

- Should ask use the same judge model as dead-end matching, or a separate answer model setting?
- How should conflicting evidence be shown when two attempts disagree?
