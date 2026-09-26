# Agent Progress — ProjectBrain

## Verified state

Harness skeleton is in place. No application code has been scaffolded.

The product contract is `docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. Fourteen features are registered, and every feature is `not_started`.

Stack this repo is held to:

- Frontend: Next.js
- Backend: Node.js
- Database: MongoDB
- Cloud: AWS

OpenAI and OpenRouter are model providers called by the API. They are not a second system of record.

Confirmed product direction:

- ProjectBrain remembers what a team decided, what failed, and why.
- Dead-End Memory is the demo: warn with proof, answer with citations, reopen a dead end when conditions change, and promote a harness version only when evals improve.
- The seeded story is Orbit, a team task app, ingested through the real pipeline.
- The memory graph and the nightly AWS reflection job are registered after the demo path.

## Next best action

Finish `f-aws-01`: run `npm install` on a machine with registry access, then run the
full `npm run typecheck`, `create-indexes`, `load-fixtures`, and `seed:orbit` scripts
against an Atlas cluster (with real OpenAI/OpenRouter keys) to gather the evidence the
verification steps require for `f-aws-01`, `f-be-01`, and `f-db-02`. After that, complete
the frontend/API scaffolding and health endpoints. Person 2 can begin the real
`checkDeadEnds`/`checkConditions` (`f-be-02`, `f-be-05`) against the same foundation.

## In progress

`f-aws-01` — Platform Foundation. Step-0 shared foundation (S1–S5) is scaffolded, and
Person 1's ingestion lane (A1–A9) is now built on top of it (see session log). Not yet
`passing`: Atlas-dependent verification, real model providers, and the Next.js/API
health endpoints are still outstanding. The A1–A9 work advances `f-be-01`, `f-be-03`,
`f-db-02`, and `f-aws-02`, but none is marked `passing` — their acceptance evidence
needs a live Atlas cluster and real providers.

## Known risks

- The Next.js app, Node.js API, and AWS deployment are not scaffolded yet. Step 0 adds
  the shared TypeScript foundation (types, Atlas schema/index defs, fixtures, placeholder
  shared functions) but not the running app.
- Dependencies are not installed in this sandbox (npm registry blocked, INTEGRATIONS_ONLY
  network → 403). The Step-0 foundation is deliberately dependency-free and type-checks
  via `npm run typecheck:foundation`. The Atlas scripts (`create-indexes`, `load-fixtures`)
  import `mongodb` and require `npm install` on a networked machine plus a live Atlas
  cluster before their evidence can be captured.
- Fixture embeddings in `fixtures/orbit.json` are deterministic offline placeholders, not
  OpenAI embeddings. They unblock retrieval work but must be regenerated with real
  embeddings before eval numbers are trusted.
- `sandbox` node tooling requires `NODE_OPTIONS` (a missing proxy-bootstrap preload) to be
  unset for `tsc`/`node` to run in this environment.
- `./init.sh` checks harness integrity now. App checks start once `package.json` exists.
- OpenAI, OpenRouter, MongoDB Atlas, Slack, and AWS accounts are not configured in this repository.
- The retired collaboration-suite plan and its screen images are no longer requirements. Do not restore them as product scope.
- Graph view, pull-request comments, voice transcription, and nightly reflection are later than the demo path. Starting them first would skip the warning, the citation, and the measured harness change.

## Session log

### 2026-09-26 — Person 1 ingestion lane (A1–A9)

- Built the "getting data in" lane on top of the Step 0 foundation. All dependency-free
  and offline-runnable; MongoDB/AWS/SDK integrations sit behind seams with in-memory
  default impls and Atlas/S3 adapters that drop in after `npm install`.
- **A1/A2 pipeline** (`src/pipeline/`): classify → extract → merge_attempt →
  embed_and_store → link, each writing a checkpoint. `merge_attempt` merges an
  attempt_result into an open attempt in the same thread / by the same author within 3
  days (R9). Prompts come from `getActiveHarness()` (R19). Checkpoints use a
  MongoDBSaver-style seam (`InMemoryCheckpointer` / `MongoCheckpointer`), never a local
  file (R34).
- **A3 Slack** (`src/connectors/slack.ts` + `crypto.ts`): v0 HMAC signature verify,
  Events API ingest, backfill, and `/brain deadend` calling `checkDeadEnds` (the S4 fake
  for now) to post a threaded warning.
- **A4 GitHub** (`src/connectors/github.ts`): signature verify; closed-unmerged PR /
  revert / wontfix issue → attempt_result; merged PR → decision; backfill helper.
- **A5 CI/logs** (`src/connectors/ci.ts` + `evidence-store.ts`): `workflow_run`
  failure → fetch log → store to object storage → Evidence record linked to the attempt
  (R4).
- **A6 capture API** (`src/api/capture.ts`): `POST /api/capture` runs the pipeline.
- **A7 seed** (`src/seed/`, `src/scripts/seed-orbit.ts`): ~150 Orbit messages through the
  REAL pipeline; attempts/decisions produced by extraction (f-db-02).
- **A8 worker** (`src/worker/`): job queue + worker entrypoint (App Runner/Lambda) and a
  validatable EventBridge deployment definition incl. the nightly reflection cron.
- **A9 Linear** (`src/connectors/linear.ts`): sums logged time into attempt `hoursSpent`.
- Rewired the shared `ingest()` to delegate to the real pipeline.
- Verified: `npm run typecheck:foundation` passes (0 errors, no deps). A behavioral smoke
  test exercised A1–A9 end-to-end — 32/32 assertions passed (attempt merge to 14h, 10
  checkpoints for 2 messages, noise → no record, Slack sig verify/reject, `/brain
  deadend` match + no-match, GitHub PR/issue mapping, CI evidence linked to attempt,
  worker drains queue, Linear hours summed, 150 seed messages → 4 attempts + 4
  decisions). Temp test artifacts were removed; `./init.sh` exits 0.
- Design doc: `docs/ingestion-lane.md`. `f-aws-01` remains the single `in_progress`
  feature; no feature was marked `passing` (Atlas + real providers still required).

### 2026-09-26 — Step 0 shared foundation (S1–S5)

- Marked `f-aws-01` `in_progress`.
- Scaffolded a dependency-free TypeScript foundation:
  - **S1** `src/types.ts` — record shapes for messages, attempts, decisions, entities,
    edges, evidence, warnings, feedback, evals, and harness configs, plus the I/O types
    for the shared functions. Traces to R1–R6, R19.
  - **S2** `src/db/schema.ts` — declarative collection + index definitions (vector on
    attempts/decisions embeddings, Atlas Search text, compound `{projectId, createdAt}`,
    and `edges.from`/`edges.to`); `src/db/client.ts` and `src/scripts/create-indexes.ts`
    apply them to Atlas.
  - **S3** `src/fixtures/orbit.ts` + `fixtures/orbit.json` — hand-written Orbit story:
    4 dead ends, 5 decisions, 10 edges, 4 evidence, v1 harness config, with deterministic
    offline embeddings; `src/scripts/load-fixtures.ts` loads it into Atlas.
  - **S4** `src/shared/index.ts` — placeholder `checkDeadEnds()`, `checkConditions()`,
    `getActiveHarness()`, `ingest()` returning fake data from the fixture.
  - **S5** `package.json`, `tsconfig*.json`, `.env.example`, `.gitignore`, `README.md`.
- Verified: `npm run typecheck:foundation` passes (0 errors); behavioral smoke test shows
  `checkDeadEnds` matches the socket.io intent to the WebSockets dead end (14h saved),
  returns no matches for an unrelated idea and for a different project (isolation), and
  `checkConditions` flips the WebSockets attempt to `revisitable` on the App Runner
  decision. `./init.sh` exits 0.
- Not done this session: `npm install`, Atlas-backed script runs, and the Next.js/API
  app. `f-aws-01` is therefore left `in_progress`, not `passing`.

### 2026-09-26 — ProjectBrain screen designs

- Added nine desktop references in `design/` for the lab-notebook UI: timeline, dead-end detail, ask, check, graph, harness lab, impact, and the Slack warning.
- Indexed them in `design/screens.md`.
- No feature was marked `in_progress`. No application code was written.

### 2026-09-26 — ProjectBrain replaces the previous product plan

- Retired the collaboration-suite contract, its eleven feature specs, and the generated screen images.
- Added the ProjectBrain Dead-End Memory contract.
- Registered fourteen features, from platform foundation through nightly reflection. None is `in_progress`.
- No application code was implemented.

### 2026-09-26 — Product UI reference screens

- Generated desktop screen images for the retired product direction.
- Those images were removed when the product contract changed.

### 2026-09-26 — Harness skeleton

- Added `AGENTS.md`, `init.sh`, `agent-progress.md`, `feature_list.json`, `docs/`, and `clean-state-checklist.md`.
- No feature is `in_progress`.
