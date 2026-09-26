# f-sh-02 — Memory Collections and Search Indexes

Lane: **Shared (Step 0)** · Covers: R1–R6, R34

## Goal

Create every MongoDB collection and index both lanes read or write, so neither lane invents its own storage.

## User-visible behavior

Project memory for one project can be stored and retrieved as messages, decisions, attempts, entities, edges, warnings, feedback, and harness versions. Search results from another project do not appear.

## Scope / out of scope

In scope:

- `scripts/db-setup.ts`: creates collections, standard indexes, the `attempts_vector` and `decisions_vector` Atlas Vector Search indexes (1536 dims, cosine, filters on `projectId`, `outcome`, `status`), and the `memory_text` Atlas Search index.
- `lib/db.ts`: one cached `MongoClient` and typed collection helpers.
- Idempotent: running setup twice changes nothing.

Out of scope:

- Pipeline logic.
- LangGraph checkpoint saver wiring (added by the lane that first needs it, in the `checkpoints` collection).

## Acceptance criteria

- Every collection named in `lib/types.ts` exists.
- `$vectorSearch` on `attempts_vector` with a `projectId` filter never returns another project's attempts.
- Setup is safe to rerun.

## Verification steps

1. Run `pnpm db:setup` against the development cluster.
2. Insert one attempt, one decision, and one edge for project `orbit`, then read them back by project id.
3. Run a `$vectorSearch` with a fixture embedding filtered to `orbit` and `outcome in [failed, abandoned]`.
4. Insert an attempt for a second project and confirm it is excluded.
5. Run `pnpm db:setup` a second time and confirm no errors.

## Dependencies

- `f-sh-01` Platform Foundation and Environments

## Open questions

- Does the Atlas tier allow three search indexes? M0 allows three in total.
