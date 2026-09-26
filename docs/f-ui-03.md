# f-ui-03 — Harness Lab and Impact

## Goal

Show whether the harness is improving, what changed, and how much time the warnings saved.

## User-visible behavior

Harness Lab shows version history, score changes, and the diff of what reflection changed. Impact shows warnings sent, hours saved from accepted warnings, and the precision trend.

## Scope / out of scope

In scope:

- Version timeline with eval scores.
- A diff between a version and its parent, including rejected candidates and their reasons.
- A Run reflection control that calls the reflection API and then shows the result.
- Impact totals for warnings sent and hours saved.
- Hours saved as the sum of `hoursSpent` on attempts tied to warnings marked helpful.
- Precision trend from stored eval runs.
- The same lab-notebook visual direction as the rest of the app.

Out of scope:

- Editing prompts by hand in the browser.
- The nightly schedule.
- Invented impact numbers that are not computed from stored warnings and attempts.

## Acceptance criteria

- At least two harness versions can be compared, with scores and a readable diff.
- Running reflection from the screen updates the timeline only when the candidate is promoted.
- A rejected run remains visible with the reason, and the previous active version stays marked active.
- Impact hours equal the sum of hours spent for accepted warnings.
- A not-relevant response is visible as feedback that reflection can use.

## Verification steps

1. Open Harness Lab and verify at least two versions with scores and a diff.
2. Run reflection from the button and verify the timeline updates only after promotion.
3. Open Impact and verify hours saved equals the sum of hours spent for accepted warnings.
4. Record a not-relevant feedback action and verify it is visible to the reflection inputs.
5. Exercise both screens in a browser.

## Dependencies

- `f-ui-01` Timeline and Dead-End Detail.
- `f-be-03` Slack Capture and Proactive Warnings.
- `f-be-06` Self-Improving Harness.

## Open questions

- Should rejected versions appear on the same timeline as promoted ones?
- Which warning statuses count as accepted for the hours-saved total?
