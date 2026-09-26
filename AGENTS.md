# AI Coding Harness: Second Brain Agent Workspace

You are operating within a Harness Engineering environment for the **Second Brain** project. This repository is the System of Record.

## Project Architecture

- **Frontend**: Next.js app (UI, routing, and client state).
- **Backend**: Node.js API (business logic, auth, and data access).
- **Database**: MongoDB (system of record for user data and memory documents).
- **Cloud**: AWS (hosting, deployment, and supporting infrastructure).

Do not introduce a second database, a worker-local store as the source of truth, or a different cloud provider unless a feature spec explicitly requires it.

## Operating Rules

### 1. Startup Workflow

Every session must begin by executing the standard startup flow:

1. Run `./init.sh` to verify the environment is healthy.
2. Read `agent-progress.md` to understand current verified state and the next best action.
3. Read `feature_list.json` to identify the `in_progress` feature.
4. If that feature has a spec at `docs/<feature-id>.md`, read it before writing code.

### 2. Feature Planning

Whenever the user plans a feature (asks to plan, spec, design, or add a new capability), create the planning artifacts **before** implementation:

1. **Write feature docs** in `docs/`:
   - Path: `docs/<feature-id>.md` (example: `docs/f-ui-06.md`). Create the `docs/` directory if it does not exist.
   - Required sections: Goal, User-visible behavior, Scope / out of scope, Acceptance criteria, Verification steps, Dependencies, Open questions.
2. **Register the feature** in `feature_list.json`:
   - Assign the next unused `id` with an area prefix (`f-ui-NN` for Next.js UI, `f-be-NN` for the Node.js API, `f-db-NN` for MongoDB, `f-aws-NN` for AWS, or another existing prefix).
   - Set `priority` after existing items unless the user specifies otherwise.
   - Copy `title`, `user_visible_behavior`, and `verification` from the docs.
   - Set `status` to `not_started` and leave `evidence` empty.
3. Do not start implementation in the same step unless the user explicitly asks to implement after planning.
4. Do not mark the new feature `in_progress` until implementation begins, and only if no other feature is already `in_progress`.

Every feature in `feature_list.json` must have a matching `docs/<feature-id>.md`. If a planned feature is missing either artifact, create the missing one before starting work.

### 3. Feature Discipline

- You may only work on **ONE** feature at a time.
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
