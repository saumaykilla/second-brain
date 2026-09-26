# f-be-06 — Decision and Action System

## Goal

Turn meeting outcomes into a traceable operating system for decisions and action items.

## User-visible behavior

Members can see what was decided, who owns each action, its current status and reminders, and the source history connecting it to meetings, knowledge, and collaboration.

## Scope / out of scope

In scope:

- First-class decision and action-item records.
- Owners, collaborators, status, due dates, reminders, and history.
- Creation from meeting records and supported manual flows.
- Links to originating meetings, transcript evidence, approved knowledge, and relevant messages.
- Personal and company views for open, completed, overdue, and changed work.
- Notification preferences and authorization.

Out of scope:

- Replacing a full project-management product.
- Automatically executing external business actions.
- External assignees who are not company members.
- Predictive employee-performance scoring.

## Acceptance criteria

- A meeting-record decision or action item can become a first-class record without losing its source evidence.
- Authorized members can create, assign, update, complete, reopen, and archive supported records.
- Every state-changing operation records who changed what and when.
- Reminders follow owner, due state, and notification preferences without producing duplicate notifications.
- Personal views show a member's owned work; company views respect role and access boundaries.
- Source links remain valid or show a clear unavailable state when source access changes.
- Search and collaboration references resolve to the canonical decision or action record.
- Cross-company or unauthorized mutation is denied.

## Verification steps

1. Run decision, action-item, history, reminder, authorization, and idempotency tests.
2. Promote extracted meeting outcomes into canonical records and verify source traceability.
3. Exercise assignment, status changes, due dates, completion, reopen, and archive flows.
4. Advance test time and verify reminder scheduling, deduplication, and preference handling.
5. Attempt unauthorized and cross-company reads and mutations.
6. Complete personal and company decision/action workflows in a browser.

## Dependencies

- `f-be-01` Company Identity and Membership.
- `f-be-05` Structured Meeting Records.
- `f-ui-03` Company Knowledge Assistant.
- `f-ui-04` Channels and Direct Messages.

## Open questions

- Which initial status models should decisions and action items use?
- Which reminder channels are required beyond in-app notifications?
- Can administrators reassign work when an owner leaves the company?
