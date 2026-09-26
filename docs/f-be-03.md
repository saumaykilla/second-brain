# f-be-03 — Meeting Scheduling and Lifecycle

## Goal

Let authenticated company members create, schedule, invite, start, end, and review member-only meetings.

## User-visible behavior

Members create instant or scheduled meetings inside Second Brain AI, invite coworkers, and see accurate upcoming, active, ended, and cancelled states.

## Scope / out of scope

In scope:

- Instant and scheduled meeting creation.
- Company-member participant selection.
- Stable meeting links and LiveKit room identity.
- Scheduled, active, ended, and cancelled lifecycle states.
- Meeting lists and detail data for dashboard and meeting screens.
- Authorization for viewing, joining, changing, and cancelling meetings.

Out of scope:

- External guests or public links.
- Google Calendar or external meeting-platform integration.
- Live media controls and AI participation.
- Recurring meetings.

## Acceptance criteria

- An authorized member can create an instant or future scheduled meeting with a title and selected company participants.
- Meeting identifiers and room names cannot be used to cross company boundaries.
- Only invited active company members can view and join a meeting.
- Valid lifecycle transitions are enforced and repeated events are idempotent.
- Organizers can update or cancel an eligible scheduled meeting.
- Starting and ending a meeting records trustworthy timestamps.
- Lists distinguish upcoming, active, ended, and cancelled meetings in stable order.

## Verification steps

1. Run meeting service and authorization unit tests.
2. Run API integration tests for create, update, cancel, start, end, list, and detail flows.
3. Attempt invalid lifecycle transitions and cross-company access.
4. Retry start/end events and verify idempotent state.
5. Create instant and scheduled meetings through the browser and verify list/detail updates.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-be-01` Company Identity and Membership.
- `f-ui-01` App Shell and Company Administration for user-facing flows.

## Open questions

- Which members may create meetings: all members or configured roles?
- What reminder behavior is required before a scheduled meeting?
- When does an abandoned active room become ended automatically?
