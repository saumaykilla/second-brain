# ProjectBrain feature docs

The product contract is `plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. These docs split it into three lanes so two people can build at the same time.

## How the split works

1. **Step 0 — Shared (`f-sh-NN`).** Both people do this together. It freezes the types, contracts, database, harness, and app shell that both lanes build on.
2. **Then split.** Person 1 takes **Capture** (`f-a-NN`): sources into Atlas. Person 2 takes **Recall** (`f-b-NN`): Atlas into answers and screens.
3. **Meet at checkpoints.** Until a checkpoint, each lane calls the other only through `lib/contracts/`. The placeholder contracts return data from `fixtures/orbit.json`, so neither lane waits on the other.

Each lane has at most one `in_progress` feature at a time. `lib/types.ts` and the contract signatures change only when both people agree, and the change is recorded in `agent-progress.md`.

## Step 0 — Shared

| Id | Feature | Depends on |
| --- | --- | --- |
| [f-sh-01](f-sh-01.md) | Platform Foundation and Environments | — |
| [f-sh-02](f-sh-02.md) | Memory Collections and Search Indexes | f-sh-01 |
| [f-sh-03](f-sh-03.md) | Harness Config v1 | f-sh-02 |
| [f-sh-04](f-sh-04.md) | Shared Types, Contracts, and Orbit Fixture | f-sh-01 |
| [f-sh-05](f-sh-05.md) | App Shell and Design Tokens | f-sh-01 |

## Person 1 — Capture (sources to Atlas)

| Id | Feature | Depends on |
| --- | --- | --- |
| [f-a-01](f-a-01.md) | Message Classification | f-sh-03, f-sh-04 |
| [f-a-02](f-a-02.md) | Attempt and Decision Extraction | f-a-01 |
| [f-a-03](f-a-03.md) | Attempt Merging and the Ingest Pipeline | f-a-02 |
| [f-a-04](f-a-04.md) | Manual Web Capture | f-a-03, f-sh-05 |
| [f-a-05](f-a-05.md) | Orbit Seed Through the Pipeline | f-a-03 |
| [f-a-06](f-a-06.md) | Slack Event Capture | f-a-03 |
| [f-a-07](f-a-07.md) | Revisitable Conditions | f-a-03 |
| [f-a-08](f-a-08.md) | Evidence Storage | f-a-03 |
| [f-a-09](f-a-09.md) | AWS Hosting and Worker | f-a-03 |

## Person 2 — Recall (Atlas to answers and UI)

| Id | Feature | Depends on |
| --- | --- | --- |
| [f-b-01](f-b-01.md) | Dead-End Check | f-sh-02, f-sh-03, f-sh-04 |
| [f-b-02](f-b-02.md) | Check an Idea | f-sh-05 |
| [f-b-03](f-b-03.md) | Ask the Brain | f-sh-02, f-sh-05 |
| [f-b-04](f-b-04.md) | Timeline and Dead-End Detail | f-sh-04, f-sh-05 |
| [f-b-05](f-b-05.md) | Slack Proactive Warning | f-b-01, f-a-06 |
| [f-b-06](f-b-06.md) | Eval Set and Runner | f-b-01, f-b-03 |
| [f-b-07](f-b-07.md) | Reflection and Promotion | f-b-06 |
| [f-b-08](f-b-08.md) | Harness Lab and Impact | f-b-07, f-sh-05 |
| [f-b-09](f-b-09.md) | Memory Graph | f-b-04 |

## Contracts between lanes

| Contract | Owner | Called by | Placeholder behavior |
| --- | --- | --- | --- |
| `ingestMessage(input)` | Capture (`f-a-03`) | Capture form, Slack events, seed | Stores the message, labels it from keywords |
| `checkConditions(projectId, decisionId)` | Capture (`f-a-07`) | `ingestMessage` | Returns the WebSockets attempt for the App Runner decision |
| `checkDeadEnds(projectId, text)` | Recall (`f-b-01`) | Check, Slack warning, evals | Keyword match against fixture dead ends |
| `getActiveHarness(projectId)` | Shared (`f-sh-03`) | Both lanes | Returns fixture harness v1 |

## Checkpoints

| Checkpoint | When | What both people confirm |
| --- | --- | --- |
| **C0 — Split** | All `f-sh` passing | `pnpm typecheck`, `pnpm test`, and `pnpm build` pass. Fixtures load. |
| **C1 — Real data** | `f-a-05` and `f-b-01` passing | Recall screens read seeded Orbit records, not fixtures. AE1 and AE2 pass on real data. |
| **C2 — Slack loop** | `f-a-06` and `f-b-05` passing | The socket.io message in Slack gets one threaded warning. |
| **C3 — Time** | `f-a-07` and `f-b-04` passing | The App Runner decision turns the WebSockets node amber on the timeline. |
| **C4 — Demo** | `f-b-08` passing | The full three-minute demo path runs end to end. |

## Suggested order

| Round | Person 1 — Capture | Person 2 — Recall |
| --- | --- | --- |
| 1 | f-a-01 Classification | f-b-04 Timeline and detail (fixtures) |
| 2 | f-a-02 Extraction | f-b-01 Dead-end check |
| 3 | f-a-03 Pipeline | f-b-02 Check an Idea |
| 4 | f-a-05 Orbit seed → **C1** | f-b-03 Ask the Brain |
| 5 | f-a-04 Web capture | f-b-06 Evals |
| 6 | f-a-06 Slack events → **C2** | f-b-05 Slack warning → **C2** |
| 7 | f-a-07 Conditions → **C3** | f-b-07 Reflection |
| 8 | f-a-08 Evidence | f-b-08 Lab and Impact → **C4** |
| 9 | f-a-09 AWS | f-b-09 Graph |

See [setup.md](setup.md) for accounts and environment variables.
