# f-sh-05 — App Shell and Design Tokens

Lane: **Shared (Step 0)** · Covers: R23–R27

## Goal

Give both lanes one layout, navigation, and set of tokens so screens built in parallel look like one product.

## User-visible behavior

Every screen shares the lab-notebook shell: paper background, beige index navigation, red margin line, and the red, amber, and green status marks.

## Scope / out of scope

In scope:

- Tokens in `app/globals.css` (paper, ink, index, margin red, amber, green).
- Two fonts: a serif for page titles and a sans for body.
- Navigation: Timeline, Capture, Ask, Check, Graph, Lab, Impact.
- Shared components: status mark, record card, and empty, loading, and error states.

Out of scope:

- Screen content. Each lane builds its own screens on this shell.

## Acceptance criteria

- Every nav route renders inside the shell.
- Status colors are defined once and reused.

## Verification steps

1. Run `pnpm build`.
2. Open each route in a browser and confirm the shell and nav render.
3. Compare against `design/01-timeline.png`.

## Dependencies

- `f-sh-01` Platform Foundation and Environments

## Open questions

- None.
