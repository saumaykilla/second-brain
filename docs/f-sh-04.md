# f-sh-04 — Shared Types, Contracts, and Orbit Fixture

Lane: **Shared (Step 0)** · Covers: R2–R6, R30–R33

## Goal

Freeze the shapes and function signatures that let the two lanes build at the same time without waiting on each other.

## User-visible behavior

Either lane can run the app against a realistic Orbit fixture before the other lane's code exists.

## Scope / out of scope

In scope:

- `lib/types.ts`: every document shape (messages, decisions, attempts, entities, edges, warnings, feedback, harness_configs, evals).
- `lib/contracts/`: `ingestMessage`, `checkDeadEnds`, `checkConditions`, `getActiveHarness`, each returning fixture-backed results until the owning lane replaces it.
- `fixtures/orbit.json`: four dead ends, the auth supersede chain, the App Runner decision, and sample messages.
- `scripts/load-fixtures.ts` and `lib/fixtures.ts`.

Out of scope:

- Real extraction or retrieval.

## Acceptance criteria

- Contracts typecheck against `lib/types.ts`.
- The placeholder `checkDeadEnds` returns the WebSockets attempt for a socket.io plan and nothing for an unrelated plan.
- The fixture matches R31–R33 (hours, alternatives, supersede chain, App Runner).

## Verification steps

1. Run `pnpm typecheck`.
2. Run `pnpm test` (fixture shape and contract tests).
3. Run `pnpm db:fixtures` when `MONGODB_URI` is set.

## Dependencies

- `f-sh-01` Platform Foundation and Environments

## Open questions

- None.
