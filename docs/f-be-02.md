# f-be-02 — Notion Knowledge Connection and Sync

## Goal

Turn administrator-approved Notion pages and databases into current, traceable company knowledge for retrieval.

## User-visible behavior

An administrator connects Notion, chooses approved sources, sees synchronization status, and can remove access; members can later receive answers linked to the approved originals.

## Scope / out of scope

In scope:

- Notion OAuth connection and disconnection.
- Administrator source discovery and explicit page/database selection.
- Initial import and incremental synchronization.
- Update, deletion, deselection, and revoked-access handling.
- Source provenance, sync status, retries, and administrator-visible failures.
- Company-wide availability of approved content.

Out of scope:

- Workspace-wide access beyond content shared with and selected for the integration.
- Mirroring per-user Notion permissions.
- Editing Notion content from Second Brain AI.
- Knowledge connectors other than Notion.

## Acceptance criteria

- Only a company administrator can connect, configure, or disconnect Notion.
- Content is imported only after an administrator selects it.
- Imported content retains its company, source type, Notion identifier, title, URL, and last observed revision time.
- Edits become retrievable after synchronization without creating contradictory active copies.
- Deleted, deselected, or inaccessible content stops appearing in retrieval.
- Transient failures retry safely without duplicating source records.
- Administrators can see connection state, last successful sync, per-source status, and actionable errors.
- One company can never retrieve another company's synchronized content.

## Verification steps

1. Run unit tests for source selection, normalization, idempotency, and deletion handling.
2. Run integration tests against a controlled Notion test workspace.
3. Import a page and database, edit them, remove one, and verify each resulting knowledge state.
4. Simulate throttling and temporary Notion failures and verify bounded retries.
5. Verify company isolation with two connected test companies.
6. Complete connection, selection, status, and disconnection flows in a browser.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-be-01` Company Identity and Membership.

## Open questions

- Which Notion block types require special rendering or normalization?
- What synchronization freshness target should administrators expect?
- Which AWS search or vector capability will hold derived retrieval indexes while MongoDB remains authoritative?
