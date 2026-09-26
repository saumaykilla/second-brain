# f-be-04 — AI Meeting Memory and Citations

## Goal

Give live meetings a trustworthy reactive AI participant that recalls approved Notion knowledge and prior meeting memory with verifiable citations.

## User-visible behavior

When a participant directly addresses CC, it answers concisely from approved company knowledge, cites the supporting sources, and admits when it cannot verify an answer.

## Scope / out of scope

In scope:

- CC participation in eligible LiveKit meetings.
- Direct-address detection for voice and meeting-thread requests.
- Retrieval across approved Notion content and eligible prior meeting records.
- Company isolation, relevance filtering, source attribution, and cited responses.
- Spoken responses and matching thread responses when the request originates in text.
- Transparent no-answer and degraded-service behavior.

Out of scope:

- Unprompted or proactive interjections in the initial phase.
- General web search or unapproved company sources.
- Autonomous changes to company data.
- Model training on customer content.

## Acceptance criteria

- CC does not answer ordinary conversation when it is not directly addressed.
- A direct company-context question triggers retrieval before an answer is produced.
- Retrieved evidence is restricted to the participant's company and currently approved sources.
- Factual claims derived from company knowledge include links to supporting Notion or meeting sources.
- Weak, conflicting, or absent evidence produces a qualified or explicit no-answer response.
- A meeting-thread question receives a thread response as well as any configured spoken response.
- Failures in retrieval or model services do not terminate the meeting.
- Relevant request, retrieval, citation, latency, and failure events are observable without logging sensitive source content unnecessarily.

## Verification steps

1. Run direct-address, retrieval filtering, grounding, citation, and no-answer unit tests.
2. Run integration tests with controlled Notion and prior-meeting fixtures for two companies.
3. Ask supported, unsupported, ambiguous, and cross-company questions in a LiveKit test meeting.
4. Verify CC remains silent during unaddressed conversation.
5. Verify text-originated requests receive persistent thread responses.
6. Simulate retrieval and model-provider failures and verify safe degradation.

## Dependencies

- `f-be-02` Notion Knowledge Connection and Sync.
- `f-be-03` Meeting Scheduling and Lifecycle.
- `f-ui-02` LiveKit Meeting Room.

## Open questions

- Which speech, language, and embedding models meet quality, latency, and cost targets?
- What confidence policy determines whether CC answers, qualifies, or declines?
- How should citations be presented in spoken responses while remaining useful in the thread?
