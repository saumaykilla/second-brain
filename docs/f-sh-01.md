# f-sh-01 — Platform Foundation and Environments

Lane: **Shared (Step 0)** · Covers: R34–R36

## Goal

Give both lanes one runnable Next.js 16 app with a Node.js API surface, typed configuration, and health checks.

## User-visible behavior

A developer can open ProjectBrain locally, see a healthy API response, and see a clear unavailable state when MongoDB or a required provider configuration is missing.

## Scope / out of scope

In scope:

- Next.js 16 App Router app with TypeScript and Tailwind CSS v4.
- `lib/env.ts`: server-only config parsed with zod. Missing values are reported, never printed.
- `GET /api/health` (process is up) and `GET /api/ready` (MongoDB reachable, required config present).
- `.env.example` listing every variable, with no values.
- Typecheck, test, and build scripts.

Out of scope:

- AWS deployment (see `f-a-09`).
- Any product screen.

## Acceptance criteria

- `/api/health` returns 200 with `{ ok: true }`.
- `/api/ready` returns 503 with the names of missing variables when config is absent, and 200 when it is present.
- No provider key is imported by a client component.

## Verification steps

1. Run `./init.sh`.
2. Run `pnpm install`.
3. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
4. Start the app and call `/api/health` and `/api/ready`.
5. Unset `MONGODB_URI` and confirm `/api/ready` returns 503 naming it.
6. Confirm `.env*` files are git-ignored and no client bundle references a provider key.

## Dependencies

- None.

## Open questions

- Which AWS service hosts the app first: App Runner or ECS Fargate? (Decided in `f-a-09`.)
