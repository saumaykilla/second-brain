# f-ui-04 — Memory Graph

## Goal

Show how decisions, attempts, and entities connect, including what superseded what and what unblocked a dead end.

## User-visible behavior

A graph shows decisions, attempts, and entities connected by caused-by, superseded-by, alternative-to, blocked-by, and unblocks edges.

## Scope / out of scope

In scope:

- A graph view for one project using a flow-graph component.
- Node types for decisions, attempts, and entities.
- The five edge types from the memory model.
- Selecting a node opens the underlying record.
- The lab-notebook visual direction, with the same red and amber attempt states as the timeline.

Out of scope:

- Graph editing by dragging to create new product records.
- This screen as a requirement for the first demo path. Timeline, dead-end detail, Ask, and Check an Idea come first.

## Acceptance criteria

- The Orbit graph shows the WebSockets attempt linked to the SSE alternative.
- The authentication decisions show sessions superseded by JWT superseded by Better Auth.
- The App Runner decision shows an unblocks link once the WebSockets attempt is revisitable.
- Selecting a node opens its decision or attempt.
- The graph is usable at desktop width.

## Verification steps

1. Render the Orbit graph and verify the WebSockets attempt links to the SSE decision.
2. Verify the authentication decisions show the superseded chain.
3. Verify selecting a node opens its record.
4. Verify the unblocks edge appears after the condition re-check.
5. Exercise the graph in a browser.

## Dependencies

- `f-ui-01` Timeline and Dead-End Detail.
- `f-be-05` Revisitable Conditions.
- `f-db-02` Orbit Seed and Eval Set.

## Open questions

- Which graph library should be used if the first choice is awkward to test?
- How should a dense entity neighborhood be collapsed?
