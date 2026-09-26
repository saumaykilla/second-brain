# f-aws-01 — Platform Foundation and Environments

## Goal

Establish the Next.js application, Node.js API, MongoDB connection, and AWS-oriented environment layout that every later ProjectBrain feature runs on.

## User-visible behavior

A developer can open ProjectBrain locally, see a healthy API response, and see a clear unavailable state when MongoDB or a required provider configuration is missing.

## Scope / out of scope

In scope:

- Next.js app and Node.js API foundations with documented local commands.
- Environment configuration for MongoDB, OpenAI, OpenRouter, Slack, and AWS.
- Health checks that distinguish process health from dependency readiness.
- Safe failure when a required configuration value is missing.
- Secrets kept out of git and out of browser code.

Out of scope:

- Memory collections, extraction, Slack delivery, and product screens.
- Production deployment and the nightly reflection schedule.
- Choosing Vercel as the host.

## Acceptance criteria

- Frontend and API start locally from documented commands.
- The health response distinguishes process health from MongoDB readiness.
- Missing required configuration fails readiness without exposing secret values.
- Model-provider keys are read only by server-side code.
- Build, lint, type-check, and test commands are documented and runnable.

## Verification steps

1. Run `./init.sh`.
2. Install dependencies using the repository-documented command.
3. Run the frontend and API build, lint, type-check, and test commands.
4. Start the local stack and verify the frontend and API health endpoints.
5. Withhold a required configuration value and verify a safe readiness failure.
6. Confirm secrets are not committed and model-provider keys are not exposed to browser code.

## Dependencies

None.

## Open questions

- Which AWS region should development and production use?
- Should the first local API live in Next.js route handlers, with a separate Node worker process added later?
