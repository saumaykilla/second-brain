---
title: ProjectBrain Dead-End Memory - Plan
type: feat
date: 2026-09-26
topic: projectbrain-dead-end-memory
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: user-directed
execution: code
---

# ProjectBrain Dead-End Memory - Plan

## Goal Capsule

- **Objective:** ProjectBrain remembers what a team decided, what failed, and why, and stops someone before they repeat a failed attempt, with the proof.
- **Product authority:** This contract replaces every earlier product plan in this repository. The matching feature documents in `docs/` divide it into implementation-sized capabilities.
- **Open blockers:** None. Implementation planning must resolve technical details without expanding the product scope.

---

## Product Contract

### Summary

ProjectBrain is a long-horizon memory for a software project. It captures attempts and decisions, retrieves them with citations, warns when a new intent matches a dead end, and reopens a dead end when a later decision removes the blocker. The prompts and retrieval settings that do this work are a versioned harness. A reflection step keeps a new harness version only when eval scores improve.

The demo moment is Dead-End Memory: a proactive warning, a cited answer, a condition that becomes true weeks later, and a measured harness improvement.

### Problem Frame

Teams repeat approaches that already failed because the reason, the evidence, and the alternative live in old threads. ProjectBrain keeps that memory coherent across weeks and measures whether recall is good enough to trust a warning.

### Key Decisions

- **Dead-End Memory is the product.** An attempt records the goal, approach, outcome, typed blockers, evidence, conditions, hours, and the alternative the team chose instead.
- **Warn only after a judge agrees.** Vector search finds candidates. A stronger model decides whether the new intent is the same approach under the same conditions.
- **Memory reasons over time.** A later decision that meets a dead end's conditions marks that attempt revisitable instead of leaving it as a permanent failure.
- **The harness is data.** Extraction prompts, match prompts, retrieval thresholds, and model routing live in versioned `harness_configs`. Reflection promotes a version only when the score improves and precision does not drop.
- **MongoDB Atlas is the system of record.** Messages, decisions, attempts, entities, edges, warnings, feedback, evals, harness versions, and LangGraph checkpoints stay in MongoDB. Embeddings and evidence objects are derived from those records.
- **AWS hosts the application.** The Next.js app and Node.js API run on AWS. OpenAI and OpenRouter are model providers called by the API. They are not a second database and not the hosting provider.

### Actors

- A1. **Project member:** Captures work, asks questions, checks an idea, and marks a warning as helpful or not relevant.
- A2. **ProjectBrain pipeline:** Classifies messages, extracts records, links them, checks dead ends, and checks whether conditions are now met.
- A3. **Reflection agent:** Proposes one harness change from failed evals and negative feedback, then keeps it only if the eval improves.
- A4. **Slack workspace:** Supplies captured messages and receives threaded warnings.
- A5. **Judge:** The person evaluating the demo needs to see each partner, one warning with evidence, one revisitable moment, a measured harness improvement, and a README that can seed and eval.

### Requirements

**Memory model**

- R1. A project is an isolated body of messages, decisions, attempts, entities, edges, warnings, feedback, and harness state.
- R2. An attempt stores goal, approach, outcome (`failed`, `partially_worked`, or `abandoned`), blockers, evidence, conditions, hours spent, authors, source messages, entities, and status (`active`, `revisitable`, or `resolved`).
- R3. Each blocker has a type of `technical_limit`, `cost`, `performance`, `library_bug`, `licensing`, `org_constraint`, or `time`, plus detail and evidence.
- R4. Evidence can be a log excerpt, a benchmark, a PR or commit link, or a Slack thread link, and a stored file can be opened from the attempt.
- R5. Decisions store title, rationale, status (`active` or `superseded`), and what superseded them.
- R6. Edges can express `caused_by`, `superseded_by`, `alternative_to`, `blocked_by`, and `unblocks`.

**Capture and extraction**

- R7. Messages can arrive from Slack or from manual web capture, and each message is classified as `decision`, `attempt_start`, `attempt_result`, `intent`, `question`, or `noise`.
- R8. Extraction writes structured attempts and decisions using the prompts in the active harness version.
- R9. An attempt start and a later result in the same thread, or by the same author within a bounded number of days, merge into one attempt.
- R10. Noise is retained as a message and does not create an attempt or decision.

**Dead-end check**

- R11. An intent, a pasted plan, or a question that proposes an approach is checked against failed and abandoned attempts in the same project.
- R12. Retrieval uses vector search filtered by project and outcome, then graph context, then a strong-model judge that returns match, confidence, reason, and whether the blocker still applies.
- R13. A warning includes the past attempt, the blocker, the evidence, the alternative, and the hours previously spent.
- R14. A different approach must not warn, even when it shares words with a dead end.
- R15. A member can mark a warning not relevant, and that feedback is available to reflection.

**Answers and time**

- R16. A project question is answered with citations to attempt and decision cards.
- R17. A superseded decision is not presented as the current decision.
- R18. When a new decision meets a dead end's conditions, ProjectBrain marks that attempt revisitable and says which blocker may no longer apply.

**Harness**

- R19. The active harness version supplies extraction prompts, match prompts, `k`, `minScore`, hybrid weight, and model routing.
- R20. The eval set contains 40 cases: 15 dead-end checks including 5 tricky non-matches, 15 decision-recall questions, and 10 condition-met cases.
- R21. Metrics include dead-end precision and recall, citation accuracy, staleness rate, and average hours saved per accepted warning.
- R22. Reflection proposes one setting change, evaluates it as a candidate version, and promotes it only when the score beats the parent and precision does not drop. Otherwise it rejects the candidate and records why.

**Product surfaces**

- R23. The timeline shows decisions and attempts over time. Active dead ends are visually distinct from revisitable ones.
- R24. Dead-end detail shows goal, approach, blockers with evidence, conditions, hours, and what the team did instead.
- R25. Ask the Brain and Check an Idea are both available in the web app. Check an Idea remains usable when Slack is not live.
- R26. Harness Lab shows versions, scores, and the diff of a promoted or rejected change, and can start reflection manually.
- R27. Impact shows warnings sent, hours saved from accepted warnings, and the precision trend.
- R28. A graph can show decisions, attempts, entities, and their edges. It is not required for the first demo path.
- R29. Slack can post a proactive warning in the thread that triggered it. A GitHub pull-request hook and voice transcription are not part of the first demo path.

**Seed story**

- R30. The seeded project is Orbit, a team task app, covering about six weeks and about 150 Slack-style messages, ingested through the real pipeline.
- R31. Orbit includes four dead ends: WebSockets on serverless (14 hours, alternative SSE), Postgres `LIKE` search (9 hours, alternative Atlas Search), a PDF library abandoned for licensing (6 hours), and a cheapest-model ticket summary at 61 percent accuracy.
- R32. Orbit includes a superseded chain from sessions to JWT to Better Auth sessions.
- R33. A later decision to move the realtime service to AWS App Runner makes the WebSockets dead end revisitable.

**Platform**

- R34. MongoDB remains authoritative. Atlas Vector Search and Atlas Search serve retrieval. LangGraph checkpoints use the MongoDB saver.
- R35. OpenAI supplies embeddings and structured extraction. OpenRouter routes cheap classification to a small model and dead-end judgment plus reflection to a strong model. That routing policy is a harness setting.
- R36. AWS runs the app and, in the later worker feature, the background worker, nightly reflection schedule, and evidence object storage.
- R37. Work is split into a shared Step 0 and two parallel lanes (Capture and Recall), as described in `docs/README.md`. Each lane has at most one implementation-active feature at a time, beginning with the shared platform foundation.

### Key Flows

- F1. **Capture an attempt.** A member describes trying an approach and later reports why it failed. ProjectBrain merges those messages into one attempt with blockers, evidence, and hours.
- F2. **Proactive warning.** A new message states an intent. ProjectBrain matches it to a dead end and replies in the thread with the reason, evidence, alternative, and hours saved.
- F3. **Ask the brain.** A member asks why an approach was rejected. The answer cites the attempt and the decision that replaced it, and does not treat a superseded decision as current.
- F4. **Check an idea.** A member pastes a plan. ProjectBrain returns similar dead ends with confidence, or an explicit non-match.
- F5. **Condition met.** A new decision satisfies a stored condition. The dead end becomes revisitable and the timeline shows that change.
- F6. **Reflection.** Failed evals and negative feedback produce one harness proposal. The eval set reruns. The proposal is promoted only if the score improves and precision holds.

### Acceptance Examples

- AE1. **Covers R11–R14.** Given Priya's WebSockets attempt failed on serverless, when Sam says he will add socket.io for live updates, then the warning cites that attempt, the connection drop, the SSE alternative, and 14 hours.
- AE2. **Covers R14.** Given the same dead end, when someone proposes a managed pub/sub product named in the conditions, then ProjectBrain does not call that proposal the same failed approach.
- AE3. **Covers R16–R17.** Given JWT was superseded by Better Auth, when a member asks what auth Orbit uses, then the answer cites Better Auth as current.
- AE4. **Covers R18, R33.** Given the WebSockets blocker is the serverless runtime, when the team decides to move realtime to AWS App Runner, then that attempt becomes revisitable.
- AE5. **Covers R22.** Given a candidate harness version lowers precision, when reflection finishes, then the parent version stays active and the rejection reason is stored.

### Success Criteria

- A repeated failed approach produces one specific warning with evidence and a hours-saved figure.
- A later decision can reopen a dead end when its conditions are met.
- Superseded decisions are not answered as current.
- A harness version changes only when measured evals improve.
- Orbit's history is produced by running seed messages through the pipeline.

### Scope Boundaries

**Deferred until the demo path is real**

- Memory graph.
- Nightly reflection. Manual reflection remains in scope.
- GitHub pull-request comments.
- Voice transcription.

**Outside this product**

- Meetings, Notion sync, channels as a chat product, or a company knowledge assistant.
- Hosting the application on Vercel. Vercel may appear only as a fact inside the Orbit story.
- A second database, or a worker-local store as the source of truth.

### Dependencies / Assumptions

- The Next.js application owns the screens and the HTTP routes.
- The Node.js API owns pipeline orchestration, authorization boundaries between projects, and model calls.
- MongoDB Atlas holds application data, vectors, search indexes, and pipeline checkpoints.
- AWS hosts the app. Object storage, the background worker, and the nightly schedule arrive in the AWS worker feature.
- Partner accounts for OpenAI, OpenRouter, MongoDB Atlas, Slack, and AWS are configured outside the repository. Secrets stay out of git and out of browser code.

### Demo Path

The shortest path that can be shown is: foundation, schema, capture pipeline, dead-end check, Orbit seed, Slack warning, cited answers, condition re-check, timeline and dead-end detail, Ask and Check an Idea, harness reflection, then Harness Lab and Impact.

Graph and the nightly AWS job follow that path. They are registered so they are not forgotten, and they are not required to rehearse the three-minute demo.
