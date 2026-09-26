# Clean State Checklist

Run this before ending a session. Leave every item checked or record why it is still open in `agent-progress.md`.

- [x] `./init.sh` exits 0.
- [x] `feature_list.json` is valid and matches the work actually done.
- [x] Each lane (`shared`, `ingest`, `serve`) has at most one feature with status `in_progress`.
- [x] `lib/types.ts` and `lib/contracts/` signatures are unchanged, or the change was agreed by both lanes and recorded in `agent-progress.md`.
- [x] Every feature id has a matching `docs/<feature-id>.md`.
- [x] No feature is `passing` unless its verification steps were run and `evidence` records the result.
- [x] `agent-progress.md` has the verified state, the next best action, known risks, and a session record.
- [x] Bugs outside the current feature are logged under "Known risks" and were not fixed in this session.
- [x] No speculative edits for features that are not `in_progress`.
- [x] Working tree has no leftover debug code, secrets, or local-only config. (`.env.local` holds the local secrets and is gitignored.)
