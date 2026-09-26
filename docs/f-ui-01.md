# f-ui-01 — Timeline and Dead-End Detail

## Goal

Show a project's decisions and attempts across time, and let a person open a dead end and see the proof.

## User-visible behavior

The Orbit timeline shows decisions and attempts over six weeks. Failed attempts are red, revisitable ones are amber, and opening a dead end shows the goal, approach, blockers, evidence, conditions, hours, and what the team did instead.

## Scope / out of scope

In scope:

- A calm lab-notebook visual direction used by every ProjectBrain screen.
- Timeline of decisions and attempts for one project.
- Distinct presentation for active dead ends and revisitable attempts.
- Dead-end detail for goal, approach, typed blockers, evidence, conditions, hours spent, authors, and the linked alternative.
- Empty, loading, and failure states.
- `GET /api/attempts` and `GET /api/attempts/:id` if they do not already exist.

Out of scope:

- Ask the Brain, Check an Idea, Harness Lab, Impact, and the graph.
- Editing harness settings.
- Slack composition.

## Acceptance criteria

- Seeded Orbit history appears in time order, including four dead ends and the authentication decision chain.
- The WebSockets detail shows the serverless blocker, evidence, 14 hours, the conditions, and the SSE alternative.
- After the attempt is revisitable, the timeline shows it as amber rather than an active failure.
- A superseded decision is visibly not current.
- The layout remains readable at a desktop width.

## Verification steps

1. Run frontend lint, type-check, and route tests.
2. Load the seeded Orbit project and verify four dead ends and the superseded authentication decisions appear in order.
3. Open the WebSockets dead end and verify evidence, 14 hours, conditions, and the SSE alternative.
4. After the condition re-check, verify that node is amber.
5. Exercise the timeline and detail flow in a browser.

## Dependencies

- `f-be-01` Capture and Extraction Pipeline.
- `f-db-02` Orbit Seed and Eval Set.
- `f-be-05` Revisitable Conditions, for the amber state.

## Open questions

- Should the timeline be a vertical notebook or a horizontal week axis?
- How should partially worked attempts be distinguished from failed and abandoned?
