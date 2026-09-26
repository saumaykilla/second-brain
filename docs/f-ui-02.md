# f-ui-02 — Ask the Brain and Check an Idea

## Goal

Let a person ask the project memory a question, or paste a plan and see whether it repeats a dead end.

## User-visible behavior

A person can ask a project question and see cited attempt and decision cards, or paste a plan and see similar dead ends with match confidence.

## Scope / out of scope

In scope:

- Ask the Brain conversation for one project, with citation cards.
- Check an Idea, including a pasted plan or pull-request description.
- Match confidence, blocker, evidence, alternative, and hours on a hit.
- An explicit no-match state.
- Loading, empty, and failure states.
- Feedback controls that call the feedback API.

Out of scope:

- Slack delivery. Check an Idea is the live fallback when Slack is unavailable.
- Harness version editing.
- Automatic retries of a rejected approach.

## Acceptance criteria

- The Postgres search question cites the benchmark and the superseding search decision.
- A superseded decision is not presented as current inside an answer.
- The socket.io plan matches the WebSockets dead end and shows confidence and 14 hours.
- A non-matching plan shows that no dead end matched.
- Feedback on an answer or warning is submitted from the screen.

## Verification steps

1. Ask the seeded Postgres question in the browser and open a citation.
2. Paste the socket.io plan into Check an Idea and verify the WebSockets dead end, confidence, and hours.
3. Paste a non-matching plan and verify an explicit no-match state.
4. Verify loading and failure states.
5. Exercise both screens in the browser.

## Dependencies

- `f-ui-01` Timeline and Dead-End Detail, for the shared shell and visual direction.
- `f-be-02` Dead-End Check.
- `f-be-04` Cited Answers.

## Open questions

- Should Check an Idea and Ask share one composer with a mode switch, or stay separate routes?
- How many citation cards should an answer show before the rest are collapsed?
