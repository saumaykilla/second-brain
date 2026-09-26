# f-db-02 — Orbit Seed and Eval Set

## Goal

Give ProjectBrain a believable six-week project history and a fixed eval set, both produced through the real capture pipeline.

## User-visible behavior

The Orbit project shows six weeks of history, including four dead ends, a superseded authentication chain, and a later decision that can reopen the WebSockets dead end. The eval set contains the cases used to measure recall.

## Scope / out of scope

In scope:

- About 150 Slack-style messages for Orbit, a team task app.
- Dead end: WebSockets on serverless, failed, 14 hours, alternative SSE.
- Dead end: Postgres `LIKE` search, too slow at 2 million rows with p95 of 3.4 seconds, 9 hours, alternative Atlas Search.
- Dead end: a PDF export library abandoned after 6 hours because the license forbids commercial use.
- Dead end: cheapest-model ticket summaries at 61 percent accuracy on an internal eval.
- Superseded decisions: sessions, then JWT, then Better Auth sessions.
- A later decision to move the realtime service to AWS App Runner.
- Forty eval cases: 15 dead-end checks including 5 tricky non-matches, 15 decision-recall questions, and 10 condition-met cases.
- A seed script that sends messages through the capture pipeline.

Out of scope:

- Hand-inserting finished attempt documents as a substitute for extraction.
- The reflection loop that consumes the eval set.
- UI for browsing the seed.

## Acceptance criteria

- Seeding an empty development database creates Orbit's messages, attempts, decisions, and edges by running the pipeline.
- The four dead ends have the specified outcomes, hours, blockers, and alternatives.
- JWT is superseded, and Better Auth sessions are the active authentication decision.
- The eval file contains exactly the required case counts.
- Running the seed twice does not duplicate Orbit's attempts.

## Verification steps

1. Run the seed script against an empty development database so messages pass through the capture pipeline.
2. Confirm four attempts with the specified outcomes, hours, and alternatives.
3. Confirm the sessions, JWT, and Better Auth chain is stored as superseded decisions.
4. Confirm the eval set contains 40 cases: 15 dead-end, 15 decision-recall, and 10 condition-met, including 5 tricky non-matches.
5. Confirm seeded attempts are produced by extraction rather than inserted as finished records.

## Dependencies

- `f-be-01` Capture and Extraction Pipeline.
- `f-be-02` Dead-End Check, for the dead-end eval cases to have a route to call.

## Open questions

- Which calendar dates inside the six weeks should the script use so the demo can say March 3?
- Should the seed script call the HTTP API or the pipeline function directly?
