# f-sh-03 — Harness Config v1

Lane: **Shared (Step 0)** · Covers: R19, R35

## Goal

Store the first harness version as data so extraction, matching, and reflection read prompts and thresholds from MongoDB.

## User-visible behavior

The active harness version for a project can be read, and it supplies the extraction prompts, match prompts, `k`, `minScore`, hybrid weight, and model routing.

## Scope / out of scope

In scope:

- `harness_configs` document shape in `lib/types.ts`.
- Seed `v1` for Orbit with starting prompts, `k: 8`, `minScore: 0.72`, `hybridWeight: 0.3`, and routing: small model for classification, strong model for judge and reflection.
- `getActiveHarness(projectId)` contract, real implementation.

Out of scope:

- Reflection and promotion (`f-b-07`).

## Acceptance criteria

- Exactly one active version per project.
- Both lanes read settings only through `getActiveHarness`.

## Verification steps

1. Run the harness unit test.
2. Load fixtures and read the active harness for `orbit`.
3. Confirm there is exactly one active version.

## Dependencies

- `f-sh-02` Memory Collections and Search Indexes

## Open questions

- Which OpenRouter model IDs are the first small and strong choices?
