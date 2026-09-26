# Person 1 — Ingestion Lane (A1–A9)

"Getting data in": sources → the capture pipeline → Atlas. Built on the Step 0
foundation (`src/types.ts`, `src/shared/*`). Everything here is dependency-free and
runs offline via in-memory seams, with MongoDB/AWS/SDK adapters that drop in after
`npm install`.

## Architecture

```
sources ──► normalize to Message ──► PIPELINE ──► Atlas (system of record)
 Slack  A3        (connectors)      classify A1
 GitHub A4                          extract  A1
 CI/logs A5                         merge    A2   ── checkpoints (MongoDBSaver) A2
 web/API A6                         embed    A2
 Linear  A9 (hoursSpent)            link     A2
                                    ▲
                          getActiveHarness() supplies prompts (R19)
 worker + EventBridge A8 runs the pipeline off the web request
 seed A7 replays ~150 Orbit messages through the real pipeline
```

## Tasks

| # | Deliverable | Files |
| --- | --- | --- |
| **A1** | LangGraph classify + extract (prompt from `getActiveHarness`) | `src/pipeline/graph.ts`, `src/pipeline/providers.ts` |
| **A2** | `merge_attempt`, `embed_and_store`, `link` + MongoDBSaver checkpoints | `src/pipeline/graph.ts`, `src/pipeline/store.ts`, `src/pipeline/checkpointer.ts`, `mongo-store.ts`, `mongo-checkpointer.ts` |
| **A3** | Slack: Events API, backfill, `/brain deadend` | `src/connectors/slack.ts`, `src/connectors/crypto.ts` |
| **A4** | GitHub: webhooks + backfill (closed PRs, reverts, wontfix) | `src/connectors/github.ts` |
| **A5** | CI/logs: `workflow_run` webhook, CloudWatch→S3, evidence | `src/connectors/ci.ts`, `src/connectors/evidence-store.ts` |
| **A6** | Manual capture API `POST /api/capture` | `src/api/capture.ts`, `src/api/router.ts` |
| **A7** | Seed ~150 Orbit messages through the real pipeline | `src/seed/*`, `src/scripts/seed-orbit.ts` |
| **A8** | Worker (App Runner/Lambda) + EventBridge schedule | `src/worker/*` |
| **A9** | Linear time logs → `hoursSpent` | `src/connectors/linear.ts` |

## The pipeline (A1 + A2)

Nodes run in order; each writes a checkpoint to MongoDB (R34), never a local file.

1. **classify** — label the message (`decision`/`attempt_start`/`attempt_result`/`intent`/`question`/`noise`) using the active harness classify prompt (R7).
2. **extract** — structure an attempt/decision using the active extract prompt (R8). Noise/question/intent create no record (R10).
3. **merge_attempt** — merge an `attempt_result` into an open attempt in the same thread, or by the same author within 3 days, instead of duplicating (R9).
4. **embed_and_store** — embed goal+approach and persist (R12).
5. **link** — create edges (`blocked_by`, etc.) (R6).

`ingest()` (the S1/S4 shared contract) now delegates to this pipeline.

## Model + storage seams

- **`ModelProvider`** — classify/extract/embed. `offlineProvider` is deterministic (no network); an OpenAI+OpenRouter routed provider drops in per the harness routing policy (R35).
- **`BrainStore`** — `InMemoryStore` for offline; `MongoStore` for Atlas (R34). All reads filter by `projectId` (R1, R14).
- **`Checkpointer`** — `InMemoryCheckpointer` / `MongoCheckpointer` (MongoDBSaver-style) (R34, A2).
- **`EvidenceStore`** — `InMemoryEvidenceStore` / S3 adapter for evidence blobs (R4, A5).

## Connectors

- **Slack (A3):** verifies the `v0` HMAC signature, ingests `message` events, backfills history, and answers `/brain deadend <plan>` by calling `checkDeadEnds` and formatting a threaded warning with blocker, evidence, alternative, and hours saved (R13, F2). Uses the fake `checkDeadEnds` until Person 2's real version lands (S4).
- **GitHub (A4):** verifies `X-Hub-Signature-256`; maps a closed-unmerged PR / revert / `wontfix` issue → `attempt_result`, and a merged PR → `decision`. Backfill helper pages historical PRs/issues through the pipeline.
- **CI/logs (A5):** handles `workflow_run` completed=failure; fetches the failing log (CloudWatch in prod), stores it to object storage (S3), writes an `Evidence` record, and links it to the attempt so it opens from the dead-end record (R4).
- **Linear (A9, optional):** sums logged time per issue into the mapped attempt's `hoursSpent`, feeding the "hours saved" figure (R13, R21).

## Worker + schedule (A8)

`src/worker/worker.ts` processes `capture`/`backfill`/`reflection` jobs off the web
request (App Runner loop or Lambda handler). `src/worker/schedule.ts` is a validatable
deployment definition (runtime, queue, evidence bucket, EventBridge schedules incl. the
nightly reflection cron) — `validateDeployment()` checks it without deploying (f-aws-02).

## Seed (A7)

`buildOrbitCorpus()` produces ~150 Slack-style messages across 6 weeks. `seedOrbit()`
runs them through the **real** pipeline so attempts/decisions are produced by
extraction, not inserted as finished records (f-db-02). Story beats reproduce the four
dead ends, the superseded auth chain, and the App Runner decision.

## Verification (offline)

`npm run typecheck:foundation` type-checks the whole lane with zero dependencies. A
behavioral smoke test exercised all of A1–A9 end-to-end: 32/32 assertions passed,
including attempt merge (14h into one attempt), 10 checkpoints for 2 messages, noise
producing no record, Slack signature verify/reject, `/brain deadend` match + no-match,
GitHub PR/issue mapping, CI evidence linked to an attempt, worker draining the queue,
Linear hours summed, and 150 seed messages yielding 4 attempts + 4 decisions via
extraction.

## Still required to mark features `passing`

- `npm install` on a networked machine, a live Atlas cluster, and real OpenAI/OpenRouter
  keys, then run the connectors/pipeline against them to capture the acceptance evidence
  in `feature_list.json` (f-be-01, f-be-03, f-db-02, f-aws-02).
- The real `checkDeadEnds`/`checkConditions` from Person 2 (this lane uses the S4 fakes).
