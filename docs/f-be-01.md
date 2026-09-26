# f-be-01 — Company Identity and Membership

## Goal

Provide isolated company workspaces with invitation-only membership, Google sign-in, roles, and safe member lifecycle management.

## User-visible behavior

An administrator creates a company, invites coworkers, assigns roles, and removes access; invited members sign in with Google and enter only their company workspace.

## Scope / out of scope

In scope:

- Google sign-in and authenticated application sessions.
- Company creation and invitation-only onboarding.
- Administrator and member roles.
- Invite, resend, revoke, role-change, sign-out, and member-removal flows.
- Tenant isolation and authorization enforcement in the API.

Out of scope:

- Open email-domain self-registration.
- Password authentication, SAML, SCIM, or additional identity providers.
- External guest identities.

## Acceptance criteria

- A new administrator can establish one company after authenticating with Google.
- An invited Google account can join the intended company exactly once.
- Uninvited accounts cannot enter a company workspace.
- Administrators can invite, revoke, remove, and change supported roles.
- The final active administrator cannot be removed or demoted without transferring responsibility.
- A member cannot read or mutate another company's resources, even with guessed identifiers.
- Revoked or removed members lose access on subsequent authorized requests.

## Verification steps

1. Run the backend authentication and authorization test suites.
2. Exercise company creation, invite acceptance, invite revocation, role change, member removal, and sign-out.
3. Attempt cross-company reads and writes with valid sessions and verify denial.
4. Verify the final-administrator safeguard.
5. Complete the Google sign-in and invitation flow in a browser.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.

## Open questions

- Which Google identity claims are required for account linking?
- How long should invitations and application sessions remain valid?
- Should a Google account be allowed to belong to multiple companies in a later phase?
