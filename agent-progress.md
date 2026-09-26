# Agent Progress — ProjectBrain

## Verified state

The shared foundation is scaffolded: Next.js 16 app shell, shared types (`lib/types.ts`), MongoDB client, placeholder contracts (`lib/contracts/`), the Orbit fixture, db setup and fixture scripts, and `/api/health` and `/api/ready`.

The product contract is `docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. Work is split into three lanes (see `docs/README.md`): shared `f-sh-01..05`, Capture `f-a-01..09`, and Recall `f-b-01..09`. That makes 23 features. `passing`: `f-sh-04`, `f-b-01`, `f-b-06`, `f-b-07`. `in_progress`: `f-sh-01` (shared lane), `f-b-02` (serve lane). The rest are `not_started`.

The whole Recall/serve lane (`f-b-01..09`) is now implemented on the Next.js app: real dead-end retrieval + judge, `/check`, `/ask`, timeline + dead-end detail, Slack proactive warning, the 40-case eval + runner, reflection + promotion, Harness Lab, Impact, and the Memory Graph. Verified offline with automated behavioral tests; browser/Atlas/live-provider verification is still outstanding for the UI-only and DB-only steps.

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

> Note (post-merge): `main` was merged into this branch and introduced a newer
> `feature_list.json` with lane-based ids (`f-sh-*` shared, `f-a-*` ingest, `f-b-*`
> serve). Older session logs below reference the previous ids (`f-aws-01`, `f-be-01`,
> etc.); they are kept as an accurate historical record. The mapping for Person 1's
> lane: A1→`f-a-01`/`f-a-02`, A2→`f-a-03`, A3→`f-a-06`, A5→`f-a-08`, A6→`f-a-04`,
> A7→`f-a-05`, A8→`f-a-09`. Step 0 corresponds to `f-sh-04` (now `passing`) and
> `f-sh-01`/`f-sh-02`/`f-sh-03`.

## Next best action

Run `pnpm install` + `pnpm build` + `pnpm test` on a networked machine to confirm the
Vercel build is green and the vitest suite (incl. the f-b-01 contract tests) passes, then
exercise `/check`, `/ask`, `/`, `/lab`, `/impact`, `/graph` in a browser and run
`pnpm eval` / `pnpm reflect` against Atlas to capture the browser/DB evidence needed to
mark `f-b-02`, `f-b-03`, `f-b-04`, `f-b-05`, `f-b-08`, `f-b-09` `passing`.

(Earlier note) Finish `f-sh-01` (Platform Foundation): run `pnpm install` on a machine with registry
access, then `pnpm typecheck`, `pnpm test`, `pnpm build`, and the DB/seed scripts against
an Atlas cluster (with real OpenAI/OpenRouter keys) to capture the acceptance evidence.
Then land the `src/` ingestion lane against the real `MongoStore`/`MongoCheckpointer` and
real provider so the `f-a-*` ingest features can be verified and marked `passing`. Person
2 can begin the real `checkDeadEnds`/`checkConditions` (`f-b-01`, `f-a-07`) against the
same foundation.

## In progress

`f-sh-01` — Platform Foundation and Environments. Person 1's ingestion lane (A1–A9) is
implemented under `src/` on top of the shared foundation (`f-sh-04`, `passing`). None of
the `f-a-*` ingest features is marked `passing` yet — their acceptance evidence needs a
live Atlas cluster and real model providers. Note: a parallel foundation exists under
`lib/` from the other track (merged from `main`); the two need reconciling into one
canonical layout before the ingest features are verified.

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

### 2026-09-26 — Fix Vercel build + implement Recall/serve lane (f-b-01..09)

- **Fixed the failed Vercel deployment.** Root cause: the earlier merge left
  `package.json`/`tsconfig.json` as the old `src/`-track versions (only `mongodb`, `tsc`
  build), and `pnpm-lock.yaml` pinned nonexistent versions (`next@16`, `react@19.3`,
  `typescript@7`). Rewrote `package.json` for Next.js (next 15.5, react 19.1, tailwind 4,
  zod, vitest, `next build`, plus `db:setup`/`db:fixtures`/`eval`/`reflect` scripts),
  wrote a Next-appropriate `tsconfig.json` (jsx preserve, bundler resolution, `@/*` alias,
  excludes the parallel `src/` track), deleted the broken lockfile (Vercel regenerates)
  and the obsolete `tsconfig.foundation.json`, and updated `.gitignore` for Next.
- **Fixed a 3rd merge casualty:** `fixtures/orbit.json` on disk was the old `src/`-track
  shape (`att_websockets_serverless`, `harnessConfigs`) which would break the app AND
  `tests/shared.test.ts`. Restored the app-track fixture (`att-websockets`, `entities`,
  `harness`, retrieval `{k:8,minScore:0.72,hybridWeight:0.3}`). Aligned `.env.example`
  `EVIDENCE_BUCKET`.
- **f-b-01 Dead-End Check (passing):** `lib/models.ts` (embeddings + judge with OpenAI/
  OpenRouter transport and deterministic offline fallbacks), `lib/retrieval.ts` (Atlas
  `$vectorSearch` filtered by project+outcome, fixture cosine fallback), rewrote
  `lib/contracts/check-dead-ends.ts` to real retrieval+judge keeping the frozen signature.
  Added `POST /api/check` and `/api/feedback`. The judge does not warn when the plan names
  the alternative (SSE/Atlas Search) and requires distinctive approach-term overlap so a
  same-topic different-approach plan does not warn (R14).
- **f-b-02 Check an Idea (in_progress):** `app/check/page.tsx` client screen with match
  cards (blocker, evidence, alternative, hours, confidence), explicit no-match, loading/
  error, and a Not-relevant feedback action. UI still to be exercised in a browser.
- **f-b-03 Ask the Brain:** `lib/answer.ts` (resolves the supersededBy chain to the current
  decision, R17; cites attempt/decision ids; no invented answer when unsupported), `POST
  /api/ask`, `app/ask/page.tsx`.
- **f-b-04 Timeline + Dead-End Detail:** `components/timeline.tsx` (red/amber/green marks,
  expandable dead-end detail with goal/approach/blockers+evidence/conditions/hours/
  alternative), wired into `app/page.tsx`.
- **f-b-05 Slack Proactive Warning:** `lib/slack.ts` (v0 signature verify, threaded
  warning via an injectable SlackClient, Warning record, not-relevant feedback), routes
  `/api/slack/events` + `/api/slack/actions`.
- **f-b-06 Eval Set + Runner (passing):** `lib/eval/eval-set.ts` (40 cases: 15 dead-end
  incl 5 tricky non-matches, 15 decision-recall, 10 condition-met), `lib/eval/runner.ts`,
  `scripts/run-eval.ts` (`pnpm eval`). Scored v1 offline: precision 0.909, recall 1.0,
  citation 1.0, condition 1.0, overall 0.968.
- **f-b-07 Reflection + Promotion (passing):** `lib/harness/reflection.ts` (promote only
  when overall improves and precision holds, else record rejection), `lib/harness/store.ts`,
  `scripts/run-reflection.ts` (`pnpm reflect`), `POST /api/reflect`. Verified: worse
  candidate rejected with reason, better candidate promoted to v2.
- **f-b-08 Harness Lab + Impact:** `/api/harness`, `/api/impact`, `app/lab/page.tsx`
  (versions + scores + change/reject reason + Run-reflection button), `app/impact/page.tsx`
  (warnings sent, hours saved from accepted warnings, precision trend).
- **f-b-09 Memory Graph:** `lib/graph.ts`, `/api/graph`, `app/graph/page.tsx` (SVG graph of
  decisions/attempts/entities with colored edges incl. the App Runner `unblocks` edge, and
  click-to-open a node's record).
- **Verification:** an automated behavioral run of the serve lane passed 18/18 (dead-end
  match/no-match/isolation/alternative, cited answer + superseded handling, eval counts +
  scores, reflection promote/reject); the original `tests/shared.test.ts` assertions were
  re-run and pass 8/8, so the existing suite stays green. Could not run `pnpm build`/
  `pnpm test`/Atlas here (npm registry blocked in the sandbox); those and the browser
  screens are the remaining verification before the UI-only features are marked `passing`.
  `./init.sh` exits 0.
- The parallel `src/` ingestion track from the previous session is excluded from the Next
  build and left in place; folding it into `lib/` remains a coordination decision.

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
