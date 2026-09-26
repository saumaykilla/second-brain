/**
 * Write the hand-authored Orbit fixture to fixtures/orbit.json (S3).
 *
 * Usage:
 *   npx tsx src/scripts/generate-fixture.ts
 *   # or after build: node dist/scripts/generate-fixture.js
 *
 * Regenerate whenever src/fixtures/orbit.ts changes so the JSON stays in sync.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { orbitFixture } from "../fixtures/orbit.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/scripts -> repo root is three up (dist/scripts/.. -> dist/.. -> root); when
// run via tsx from src/scripts the same relative walk lands at repo root.
const repoRoot = resolve(here, "..", "..", "..");
const outDir = resolve(repoRoot, "fixtures");
const outFile = resolve(outDir, "orbit.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(orbitFixture, null, 2) + "\n");
console.log(
  `wrote ${outFile}: ${orbitFixture.attempts.length} attempts, ` +
    `${orbitFixture.decisions.length} decisions, ${orbitFixture.edges.length} edges, ` +
    `${orbitFixture.evidence.length} evidence`
);
