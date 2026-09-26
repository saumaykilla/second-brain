/**
 * Runnable Orbit seed (A7). Offline by default.
 *
 * Usage:
 *   npx tsx src/scripts/seed-orbit.ts
 *   # after build: node dist/scripts/seed-orbit.js
 *
 * To seed a real Atlas DB, wire MongoStore/MongoCheckpointer deps here (requires
 * npm install + MONGODB_URI). Kept offline-safe so it runs in the sandbox.
 */

import { seedOrbit } from "../seed/seed-orbit.js";

const summary = await seedOrbit();
console.log(JSON.stringify(summary, null, 2));
