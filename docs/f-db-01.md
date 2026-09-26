# f-db-01 — Memory Collections and Search Indexes

## Goal

Store ProjectBrain's project memory in MongoDB so attempts, decisions, messages, links, harness versions, and checkpoints can be filtered by project and searched later.

## User-visible behavior

Project memory for one project can be stored and retrieved as messages, decisions, attempts, entities, edges, warnings, feedback, and harness versions. Search results from another project do not appear.

## Scope / out of scope

In scope:

- Collections for messages, decisions, attempts, entities, edges, harness configs, eval cases, eval runs, feedback, warnings, and LangGraph checkpoints.
- Attempt fields for goal, approach, outcome, typed blockers, evidence, conditions, hours, authors, source messages, entities, status, and embedding.
- Decision fields for title, rationale, active or superseded status, and successor.
- Edge types `caused_by`, `superseded_by`, `alternative_to`, `blocked_by`, and `unblocks`.
- Vector search indexes on attempt and decision embeddings, filtered by project, status, and outcome.
- Text search indexes for hybrid retrieval on title, approach, and blocker detail.
- Ordinary indexes for project time order and edge endpoints.

Out of scope:

- The extraction pipeline that fills these collections.
- The dead-end judge and product screens.
- A second database for vectors or checkpoints.

## Acceptance criteria

- Each collection can store and read the fields defined by the product contract.
- Vector search for dead ends can filter to one project and to failed or abandoned outcomes.
- A query for one project cannot return another project's attempts or decisions.
- Pipeline checkpoints are stored in MongoDB.
- Evidence can store inline text and an optional object URL.

## Verification steps

1. Apply the collection and index definitions to the development database.
2. Insert one attempt, one decision, and one edge, then read them back by project id.
3. Run the dead-end vector search shape against a fixture embedding and confirm the project and outcome filters.
4. Confirm a second project id is excluded from those results.
5. Confirm pipeline checkpoints are stored in MongoDB and not in a worker-local file.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.

## Open questions

- What similarity threshold should the index use before the harness `minScore` exists?
- Should entity aliases be unique per project or globally unique names with a project id?
