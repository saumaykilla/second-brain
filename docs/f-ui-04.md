# f-ui-04 — Channels and Direct Messages

## Goal

Extend Second Brain AI into a real-time collaboration suite with company channels and member-to-member direct messages linked to meetings and company knowledge.

## User-visible behavior

Members communicate in channels and direct messages, see unread activity, and reference meetings, records, approved knowledge, decisions, and action items.

## Scope / out of scope

In scope:

- Public company channels and eligible private channels.
- One-to-one direct messages.
- Real-time message delivery, durable history, unread state, and basic search.
- Message links or previews for meetings, records, knowledge sources, decisions, and action items.
- Channel creation, membership, and supported administration.

Out of scope:

- Cross-company messaging or external guests.
- Large public communities.
- Voice huddles separate from meeting rooms.
- Bots or third-party app marketplaces.
- Replacing source records with copied message content.

## Acceptance criteria

- Members can send and receive messages in channels they may access and in their direct conversations.
- Private-channel content is unavailable to non-members.
- Direct messages are visible only to their participants and authorized operational controls.
- Message ordering, pagination, reconnect, retries, and duplicate-send handling are reliable.
- Unread state is synchronized across supported sessions.
- References open the authoritative meeting, record, knowledge, decision, or action item when the member has access.
- Removing access prevents future reads without leaking message previews.
- Search respects company, channel, and direct-message permissions.
- Primary messaging flows work at desktop and mobile widths.

## Verification steps

1. Run channel, direct-message, membership, authorization, delivery, unread, and search tests.
2. Exercise public channel, private channel, and direct-message flows with multiple members.
3. Attempt private-channel, direct-message, and cross-company access as unauthorized users.
4. Test reconnect, duplicate-send, pagination, and concurrent-message behavior.
5. Verify references to meetings and knowledge preserve target authorization.
6. Complete desktop and mobile messaging flows in a browser.

## Dependencies

- `f-be-01` Company Identity and Membership.
- `f-ui-01` App Shell and Company Administration.
- `f-be-03` Meeting Scheduling and Lifecycle.
- `f-be-05` Structured Meeting Records.

## Open questions

- Are threaded channel replies required in the first collaboration release?
- Which attachment types, if any, should be supported?
- What message retention and administrator moderation controls are required?
