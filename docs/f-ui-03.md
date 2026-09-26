# f-ui-03 — Company Knowledge Assistant

## Goal

Give members an outside-meeting assistant for cited questions across approved Notion knowledge and prior meeting records.

## User-visible behavior

Members ask company questions in a dedicated assistant, receive concise cited answers, inspect the supporting sources, and continue a conversation without losing context.

## Scope / out of scope

In scope:

- Dedicated company assistant interface.
- Conversational questions over the same approved corpus used by meeting memory.
- Answers with Notion and meeting-record citations.
- Source previews, links, conversation history, and clear no-answer states.
- Company isolation and member authorization.

Out of scope:

- Public or anonymous access.
- General-purpose web search.
- Editing source documents through the assistant.
- Taking consequential actions without explicit product features and authorization.

## Acceptance criteria

- Active members can start, continue, revisit, and delete their assistant conversations.
- Answers use only approved company knowledge and eligible prior meeting records.
- Each material factual answer provides inspectable source citations.
- Notion and meeting sources are visually distinguishable.
- Unsupported or conflicting evidence is communicated rather than concealed.
- Removing a source prevents it from supporting future answers.
- A member cannot access another company's conversations or knowledge.
- The interface supports loading, streaming, completion, cancellation, empty, and failure states accessibly.

## Verification steps

1. Run assistant conversation, authorization, retrieval, citation, and source-removal tests.
2. Ask controlled questions answerable by Notion, prior meetings, both source types, and neither.
3. Verify multi-turn context without allowing earlier conversation text to bypass source restrictions.
4. Remove an approved source and verify it no longer supports new answers.
5. Attempt cross-company conversation and source access.
6. Exercise desktop and mobile assistant flows in a browser.

## Dependencies

- `f-be-01` Company Identity and Membership.
- `f-be-02` Notion Knowledge Connection and Sync.
- `f-be-04` AI Meeting Memory and Citations.
- `f-be-05` Structured Meeting Records.

## Open questions

- How long should assistant conversation history be retained?
- Should administrators be able to audit assistant usage without reading private conversation content?
- Which answer feedback controls are required for retrieval-quality improvement?
