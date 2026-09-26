# f-be-05 — Revisitable Conditions

## Goal

Notice when a new decision removes the blocker that made an earlier attempt fail.

## User-visible behavior

When a new decision satisfies a dead end's conditions, ProjectBrain says that dead end may now be possible and marks it revisitable instead of leaving it as an active failure.

## Scope / out of scope

In scope:

- A pipeline node that runs on new decisions.
- Semantic comparison between the decision and stored attempt conditions.
- Status change from `active` to `revisitable` when the judge says the blocker may no longer apply.
- An `unblocks` edge from the decision to the attempt.
- A stored explanation of which blocker was affected.
- The same check can run from a database change stream or an equivalent application trigger.

Out of scope:

- Automatically retrying the old approach.
- Nightly batch reflection.
- Turning the timeline node amber. The UI feature reads the status this feature writes.

## Acceptance criteria

- The Orbit decision to move realtime to AWS App Runner marks the WebSockets attempt revisitable.
- The stored explanation names the serverless runtime blocker.
- An unrelated decision does not change other dead ends.
- Repeating the decision event does not create a second status transition.
- The attempt is not marked resolved. Revisitable means it may be possible, not that it succeeded.

## Verification steps

1. Capture the App Runner decision through the pipeline.
2. Verify the WebSockets attempt status becomes revisitable and the explanation names the serverless blocker.
3. Verify an unrelated decision does not flip other dead ends.
4. Verify the link between the new decision and the attempt is stored.
5. Replay the decision event and verify a single transition.

## Dependencies

- `f-be-01` Capture and Extraction Pipeline.
- `f-db-02` Orbit Seed and Eval Set.

## Open questions

- Should a revisitable attempt stay in the dead-end warning index with a lower warning strength?
- Who can manually move an attempt back to active or forward to resolved?
