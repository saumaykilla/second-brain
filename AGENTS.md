# AI Coding Harness: Second Brain Agent Workspace

You are operating within a Harness Engineering environment for the **Second Brain** project. This repository is the System of Record.

## Project Architecture

- **Frontend**: Next.js app (UI, routing, and client state).
- **Backend**: Node.js API (business logic, auth, and data access).
- **Database**: MongoDB (system of record for user data and memory documents).
- **Cloud**: AWS (hosting, deployment, and supporting infrastructure).

Do not introduce a second database, a worker-local store as the source of truth, or a different cloud provider unless a feature spec explicitly requires it.

The product contract is ProjectBrain in `docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. Earlier product plans are not requirements. OpenAI and OpenRouter are model providers called by the API. MongoDB remains the system of record, and AWS remains the host.

## Operating Rules

### 1. Startup Workflow

Every session must begin by executing the standard startup flow:

1. Run `./init.sh` to verify the environment is healthy.
2. Read `agent-progress.md` to understand current verified state and the next best action.
3. Read `feature_list.json` and `docs/README.md` to identify your lane and its `in_progress` feature.
4. If that feature has a spec at `docs/<feature-id>.md`, read it before writing code.

### Lanes

Work is split into three lanes so two people can build in parallel:

- `shared` (`f-sh-NN`): Step 0, done together before splitting up.
- `ingest` (`f-a-NN`): Person 1, sources to Atlas.
- `serve` (`f-b-NN`): Person 2, Atlas to answers and UI.

Lanes meet only at the checkpoints in `docs/README.md`. Before a checkpoint, call the other lane's code only through `lib/contracts/` and read only `lib/types.ts` shapes. Do not change `lib/types.ts` or a contract signature without both lanes agreeing and recording it in `agent-progress.md`.

### 2. Feature Planning

Whenever the user plans a feature (asks to plan, spec, design, or add a new capability), create the planning artifacts **before** implementation:

1. **Write feature docs** in `docs/`:
   - Path: `docs/<feature-id>.md` (example: `docs/f-b-10.md`). Create the `docs/` directory if it does not exist.
   - Required sections: Goal, User-visible behavior, Scope / out of scope, Acceptance criteria, Verification steps, Dependencies, Open questions.
   - Add the feature to the lane table in `docs/README.md`.
2. **Register the feature** in `feature_list.json`:
   - Assign the next unused `id` with the lane prefix (`f-sh-NN`, `f-a-NN`, or `f-b-NN`) and set `lane` and `depends_on`.
   - Set `priority` after existing items unless the user specifies otherwise.
   - Copy `title`, `user_visible_behavior`, and `verification` from the docs.
   - Set `status` to `not_started` and leave `evidence` empty.
3. Do not start implementation in the same step unless the user explicitly asks to implement after planning.
4. Do not mark the new feature `in_progress` until implementation begins, and only if no other feature in the same lane is already `in_progress`.

Every feature in `feature_list.json` must have a matching `docs/<feature-id>.md`. If a planned feature is missing either artifact, create the missing one before starting work.

### 3. Feature Discipline

- You may only work on **ONE** feature at a time, and each lane has at most one `in_progress` feature.
- The target feature must be marked `in_progress` in `feature_list.json`.
- Do not make speculative edits for future features.
- If you notice a bug outside your feature scope, document it in `agent-progress.md` under "Known risks" instead of fixing it immediately.

### 4. Verification & Evidence

- Never mark a feature as `passing` unless you have explicitly run the verification steps defined in `feature_list.json`.
- Do not trust your own code reading as verification; you must run tests or explicit debug loops.
- Record the exact command output or test success in the `evidence` field.
- For Next.js UI changes, exercise the affected flow in the browser before marking the feature `passing`.

### 5. End of Session

Before stopping your work:

1. Run through the `clean-state-checklist.md`.
2. Update `agent-progress.md` with your session record.
3. Update `feature_list.json` statuses.
4. Ensure `./init.sh` still runs cleanly.

---

**Do not skip these steps. Do not declare victory early. The repository is the only source of truth.**
