# ProjectBrain

Long-horizon **dead-end memory** for software teams. ProjectBrain remembers what a
team decided, what failed, and why — and stops someone before they repeat a failed
attempt, **with the proof**.

Product contract: [`docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`](docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md).

- **Frontend:** Next.js · **Backend:** Node.js · **Database:** MongoDB Atlas (system of record) · **Cloud:** AWS
- Model providers: OpenAI (embeddings + extraction), OpenRouter (classify + judge/reflection routing).

---

## Step 0 — shared foundation (this PR)

The tasks that block both partners before work splits (`S1`–`S5`):

| Task | Deliverable | Where |
| --- | --- | --- |
| **S1** Record shapes for attempts, decisions, edges, evidence, warnings, harness_configs | `types.ts` | [`src/types.ts`](src/types.ts) |
| **S2** Atlas collections + indexes (vector, text, `{projectId, createdAt}`, `edges.from`/`edges.to`) | index/collection defs + create script | [`src/db/schema.ts`](src/db/schema.ts), [`src/scripts/create-indexes.ts`](src/scripts/create-indexes.ts) |
| **S3** Hand-written fake data (4 Orbit dead ends, 5 decisions, 10 edges) with embeddings + load script | `fixtures/orbit.json` + loader | [`fixtures/orbit.json`](fixtures/orbit.json), [`src/fixtures/orbit.ts`](src/fixtures/orbit.ts), [`src/scripts/load-fixtures.ts`](src/scripts/load-fixtures.ts) |
| **S4** Placeholder shared functions returning fake data | `checkDeadEnds()`, `checkConditions()`, `getActiveHarness()`, `ingest()` | [`src/shared/index.ts`](src/shared/index.ts) |
| **S5** Repo, env vars, Slack/GitHub apps, AWS account | scaffold + `.env.example` | this repo, [`.env.example`](.env.example) |

### The contract

`src/types.ts` is the agreed shape (S1). `src/shared/index.ts` (S4) exposes the four
functions both partners build against. **The signatures are the contract — don't change
them without agreeing.** Placeholders return realistic fake data drawn from the Orbit
fixture, so:

- **Person 1** (ingestion) can call `checkDeadEnds()` for thread warnings (A3) and
  `getActiveHarness()` for extraction prompts (A1) before Person 2's real versions exist.
- **Person 2** (retrieval/judge) replaces `checkDeadEnds` / `checkConditions` with real
  Atlas vector search + a judge (`f-be-02`, `f-be-05`).

---

## Person 1 — ingestion lane (A1–A9)

"Getting data in": sources → the capture pipeline → Atlas. See
[`docs/ingestion-lane.md`](docs/ingestion-lane.md) for the full write-up.

| # | Deliverable | Files |
| --- | --- | --- |
| **A1** | LangGraph classify + extract (prompt from `getActiveHarness`) | `src/pipeline/graph.ts`, `providers.ts` |
| **A2** | `merge_attempt` / `embed_and_store` / `link` + MongoDBSaver checkpoints | `src/pipeline/*`, `mongo-store.ts`, `mongo-checkpointer.ts` |
| **A3** | Slack: Events API, backfill, `/brain deadend` | `src/connectors/slack.ts`, `crypto.ts` |
| **A4** | GitHub: webhooks + backfill (closed PRs, reverts, wontfix) | `src/connectors/github.ts` |
| **A5** | CI/logs: `workflow_run` webhook, CloudWatch→S3, evidence | `src/connectors/ci.ts`, `evidence-store.ts` |
| **A6** | Manual capture API `POST /api/capture` | `src/api/capture.ts` |
| **A7** | Seed ~150 Orbit messages through the real pipeline | `src/seed/*`, `src/scripts/seed-orbit.ts` |
| **A8** | Worker (App Runner/Lambda) + EventBridge schedule | `src/worker/*` |
| **A9** | Linear time logs → `hoursSpent` | `src/connectors/linear.ts` |

The shared `ingest()` now delegates to the real pipeline. Everything runs offline via
in-memory seams (`InMemoryStore`, `InMemoryCheckpointer`, `offlineProvider`); the Atlas
(`MongoStore`, `MongoCheckpointer`), S3, and OpenAI/OpenRouter adapters drop in after
`npm install`.

## Getting started

### 1. Prerequisites (S5)

- Node.js ≥ 20
- A MongoDB **Atlas** cluster (Atlas Search + Vector Search require Atlas, not a local mongod)
- Accounts/apps configured **outside the repo**: OpenAI, OpenRouter, Slack app, GitHub app, AWS.
  Secrets stay out of git and out of browser code.

### 2. Install & configure

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI, provider keys, app secrets
```

> Network note: this repo's Step-0 foundation (`types.ts`, schema defs, fixtures,
> placeholder functions) is dependency-free and type-checks without installing anything:
> `npm run typecheck:foundation`. The Atlas scripts need `npm install` (they import `mongodb`).

### 3. Create collections & indexes (S2)

```bash
npm run build
node dist/scripts/create-indexes.js
```

Creates every collection and these indexes:
- **Vector** on `attempts.embedding` and `decisions.embedding` (filtered by `projectId` + `outcome`/`status`)
- **Text** (Atlas Search) on attempts and decisions
- Compound `{ projectId, createdAt }` on the time-ordered collections
- `edges.from` and `edges.to` for graph traversal

### 4. Load the Orbit fixture (S3)

```bash
node dist/scripts/load-fixtures.js
```

Loads the 4 dead ends, 5 decisions, 10 edges, and the v1 harness config for the `orbit` project.

> Regenerate `fixtures/orbit.json` from the typed source with
> `node dist/scripts/generate-fixture.js` after editing `src/fixtures/orbit.ts`.

---

## The Orbit story (fixture)

Six weeks of history for a team task app (`R31`–`R33`):

- **4 dead ends:** WebSockets on serverless (14 h → SSE), Postgres `LIKE` search
  (9 h → Atlas Search), a PDF library abandoned for licensing (6 h), a cheapest-model
  ticket summary at 61% accuracy.
- **Superseded auth chain:** sessions → JWT → Better Auth (current).
- **Revisitable moment:** the decision to move realtime to **AWS App Runner** makes the
  WebSockets dead end revisitable (`checkConditions()` flips it to `revisitable`).

The fixture embeddings are **deterministic offline placeholders**, not OpenAI vectors —
they exist so retrieval work can start without network access. The real Orbit history is
later produced by running seed messages through the pipeline (`A7` / `f-db-02`).

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck:foundation` | Type-check the dependency-free Step-0 core (no install needed) |
| `npm run typecheck` | Full type-check (after `npm install`) |
| `npm run build` | Compile TS → `dist/` |
| `node dist/scripts/create-indexes.js` | Create Atlas collections + indexes (S2) |
| `node dist/scripts/generate-fixture.js` | Regenerate `fixtures/orbit.json` from typed source |
| `node dist/scripts/load-fixtures.js` | Load the Orbit fixture into Atlas (S3) |
| `node dist/scripts/seed-orbit.js` | Seed ~150 Orbit messages through the real pipeline (A7) |

## Repository conventions

This repo is an AI coding **harness**. Before changing anything, read
[`AGENTS.md`](AGENTS.md), then `agent-progress.md` and `feature_list.json`. `./init.sh`
verifies harness health.
