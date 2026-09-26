# f-be-02 — Dead-End Check

## Goal

Decide whether a new intent repeats a failed or abandoned approach, and return the proof only when the judge agrees.

## User-visible behavior

Pasting a plan that repeats a failed approach returns the matching dead end, the blocker, the evidence, the alternative, the hours previously spent, and a confidence score. A genuinely different idea does not warn.

## Scope / out of scope

In scope:

- `POST /api/check` for a pasted plan or pull-request description.
- Vector search over attempts filtered by project and by failed or abandoned outcome.
- Graph lookup of related edges, limited in depth.
- A strong-model judge returning match, confidence, reason, and whether the blocker still applies.
- Confidence cutoff from the active harness `minScore`.
- Hybrid text-and-vector retrieval using the harness hybrid weight.

Out of scope:

- Posting the warning into Slack.
- Changing attempt status to revisitable.
- The GitHub Action that calls this route. The route must exist; the Action is deferred.

## Acceptance criteria

- A plan that restates a stored failed approach returns that attempt, its blockers, evidence, alternative, hours, and confidence.
- A plan that only shares vocabulary with a dead end, or that matches a stored condition for a different approach, does not warn.
- The judge can reject a high vector score when the conditions are not the same.
- Results never include attempts from another project.
- The response cites stored records rather than an unsourced summary.

## Verification steps

1. Run the retrieval and judge unit tests, including tricky non-matches.
2. `POST /api/check` with a WebSockets-on-serverless idea and verify a match above the cutoff, with blockers and hours spent.
3. `POST /api/check` with an unrelated idea and verify no warning.
4. Verify the judge can reject a high vector score when conditions differ.
5. Verify results never include another project's attempts.

## Dependencies

- `f-be-01` Capture and Extraction Pipeline.

## Open questions

- What confidence value should the first harness version use before evals tune it?
- Should a partially worked attempt be searchable as a dead end, or only failed and abandoned?
