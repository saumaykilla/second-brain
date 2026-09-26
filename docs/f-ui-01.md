# f-ui-01 — App Shell and Company Administration

## Goal

Provide the authenticated navigation, dashboard, responsive shell, and administration surfaces needed to operate a company workspace.

## User-visible behavior

Members land in a responsive company workspace with clear navigation; administrators can manage people, Notion sources, and company settings from dedicated screens.

## Scope / out of scope

In scope:

- Authenticated responsive application shell and navigation.
- Home dashboard with relevant meetings, records, knowledge status, and activity.
- People and role administration.
- Notion connection and source-management screens.
- Company and member profile settings.
- Loading, empty, error, and permission-denied states.

Out of scope:

- Implementing authentication, sync, meetings, or AI business logic in the browser.
- Channels, direct messages, or decision-management screens before their features begin.
- Theme marketplaces or extensive visual customization.

## Acceptance criteria

- Authenticated members see only navigation and actions allowed by their role.
- The shell works at supported desktop and mobile widths without hidden or overlapping controls.
- The dashboard uses real company data and presents useful empty states before meetings or knowledge exist.
- Administrators can complete people and Notion configuration flows from the UI.
- Non-administrators cannot access administration screens through navigation or direct URLs.
- Failure and reconnect states explain what happened without exposing secrets or raw backend errors.
- Keyboard navigation and accessible names cover primary controls and forms.

## Verification steps

1. Run frontend lint, type-check, component, and route tests.
2. Verify member and administrator navigation with separate test accounts.
3. Exercise loading, empty, populated, permission-denied, and API-failure states.
4. Test primary screens at desktop and mobile viewport widths in a browser.
5. Complete people, Notion source, company, and profile flows in the browser.
6. Run the configured accessibility checks for primary routes.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-be-01` Company Identity and Membership.
- `f-be-02` Notion Knowledge Connection and Sync for live Notion administration.

## Open questions

- Which dashboard cards are essential before meeting features exist?
- Which mobile navigation pattern best fits later channels and direct messages?
- Should company branding extend beyond company name and avatar in the first release?
