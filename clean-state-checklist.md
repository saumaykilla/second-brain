# Clean State Checklist

Run this before ending a session. Leave every item checked or record why it is still open in `agent-progress.md`.

- [ ] `./init.sh` exits 0.
- [ ] `feature_list.json` is valid and matches the work actually done.
- [ ] Each lane (`shared`, `ingest`, `serve`) has at most one feature with status `in_progress`.
- [ ] `lib/types.ts` and `lib/contracts/` signatures are unchanged, or the change was agreed by both lanes and recorded in `agent-progress.md`.
- [ ] Every feature id has a matching `docs/<feature-id>.md`.
- [ ] No feature is `passing` unless its verification steps were run and `evidence` records the result.
- [ ] `agent-progress.md` has the verified state, the next best action, known risks, and a session record.
- [ ] Bugs outside the current feature are logged under "Known risks" and were not fixed in this session.
- [ ] No speculative edits for features that are not `in_progress`.
- [ ] Working tree has no leftover debug code, secrets, or local-only config.
