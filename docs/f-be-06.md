# f-be-06 — Self-Improving Harness

## Goal

Change the harness only when a measured eval says the change is better and precision does not get worse.

## User-visible behavior

Running reflection proposes one harness change, re-runs the eval set, and keeps the new version only when the score improves without a precision drop. Rejected proposals stay recorded with the reason.

## Scope / out of scope

In scope:

- `POST /api/harness/reflect` and `POST /api/eval/run`.
- Loading failed eval cases and negative feedback.
- A strong-model proposal that changes one setting: an extraction or match prompt, `minScore`, `k`, hybrid weight, or model routing.
- Candidate harness versions linked to their parent.
- Promotion only when the candidate score beats the parent and dead-end precision does not drop.
- Rejection with a stored reason when promotion fails.
- Metrics for dead-end precision and recall, citation accuracy, staleness rate, and average hours saved per accepted warning.
- Pipeline reads of prompts and thresholds from the active version.

Out of scope:

- The Harness Lab screen.
- The nightly EventBridge schedule. This feature runs when invoked.
- Automatic edits to more than one setting per reflection.

## Acceptance criteria

- The eval runner scores the 40 Orbit cases and stores an eval run for the active version.
- A candidate that lowers precision is not promoted, and the reason is stored.
- A candidate that improves the parent score without lowering precision becomes active.
- Extraction and dead-end matching use the active version's prompts and thresholds.
- Reflection considers failed cases and negative feedback, and proposes one change.

## Verification steps

1. Run the eval runner on the 40 cases and record precision, recall, citation accuracy, and staleness.
2. Force a candidate that lowers precision and verify it is not promoted.
3. Run a candidate that improves the parent score and verify it becomes the active harness version.
4. Verify extraction and matching read prompts and thresholds from the active harness config.
5. Verify feedback and failed cases are inputs to the proposal.

## Dependencies

- `f-be-02` Dead-End Check.
- `f-be-04` Cited Answers.
- `f-be-05` Revisitable Conditions.
- `f-db-02` Orbit Seed and Eval Set.

## Open questions

- Which single aggregate score should decide "beats the parent"?
- Should a tie keep the parent even if precision is unchanged?
