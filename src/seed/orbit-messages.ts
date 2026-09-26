/**
 * Orbit seed message corpus (A7).
 *
 * ~150 Slack-style messages spanning ~6 weeks that, when run through the REAL
 * pipeline, reproduce the Orbit story (R30-R33): the four dead ends, the
 * superseded auth chain, the SSE alternative, and the App Runner decision that
 * makes the WebSockets dead end revisitable.
 *
 * These are raw messages — attempts/decisions are produced by extraction, not
 * inserted as finished records (f-db-02 verification).
 */

import type { IngestInput } from "../types.js";

const PROJECT = "orbit";
const authors = ["priya", "sam", "dev", "mara", "tomas"] as const;

function day(week: number, dayOffset: number, hour = 10): string {
  const base = Date.parse("2026-08-15T00:00:00.000Z");
  return new Date(
    base + (week * 7 + dayOffset) * 864e5 + hour * 3600 * 1000
  ).toISOString();
}

interface Raw {
  week: number;
  d: number;
  hour?: number;
  author: (typeof authors)[number];
  text: string;
  thread?: string;
}

/** The "story beat" messages that must produce the key records. */
const beats: Raw[] = [
  // --- WebSockets on serverless dead end (14h -> SSE) ---
  { week: 0, d: 1, author: "priya", text: "I'll try adding a socket.io WebSocket server on our Lambda backend for live task-board updates.", thread: "ws" },
  { week: 0, d: 3, author: "priya", text: "socket.io on serverless didn't work — the Lambda freezes between invocations so the WebSocket connection drops after about 30s. Spent 14 hours on this. It's a hard technical limit.", thread: "ws" },
  { week: 0, d: 4, author: "priya", text: "We decided to use Server-Sent Events for one-way live updates instead of WebSockets.", thread: "sse" },

  // --- Postgres LIKE search dead end (9h -> Atlas Search) ---
  { week: 1, d: 1, author: "sam", text: "Going to try Postgres LIKE '%term%' queries for full-text task search.", thread: "search" },
  { week: 1, d: 4, author: "sam", text: "Postgres ILIKE '%term%' failed on performance — p95 hit 2.4s on 120k rows because infix LIKE can't use an index and does a seq scan. Burned 9 hours. Prototyped MongoDB Atlas Search at 40ms p95 instead.", thread: "search" },

  // --- PDF library abandoned for licensing (6h) ---
  { week: 2, d: 2, author: "dev", text: "I'll try the PDFKitPro library to export task reports as PDF.", thread: "pdf" },
  { week: 2, d: 5, author: "dev", text: "Dropping PDFKitPro — its license forbids commercial redistribution without a paid per-seat license. Abandoned after 6 hours. We'll look at an MIT PDF library.", thread: "pdf" },

  // --- Cheapest-model ticket summary at 61% (7h) ---
  { week: 3, d: 1, author: "priya", text: "Going to try the cheapest LLM to auto-summarize support tickets.", thread: "summary" },
  { week: 3, d: 4, author: "priya", text: "The cheapest model failed — only 61% factual accuracy on 50 labelled tickets, target was 85%. Reviewers rejected them as unreliable. About 7 hours in.", thread: "summary" },

  // --- Superseded auth chain: sessions -> JWT -> Better Auth ---
  { week: 0, d: 0, author: "sam", text: "We decided to use server-side sessions for authentication to ship the first version.", thread: "auth" },
  { week: 2, d: 0, author: "priya", text: "We're switching authentication to stateless JWTs so we can scale horizontally.", thread: "auth" },
  { week: 4, d: 1, author: "sam", text: "We decided to adopt Better Auth sessions as our auth system — JWT revocation was error-prone.", thread: "auth" },

  // --- App Runner decision makes WebSockets revisitable (R33) ---
  { week: 5, d: 2, author: "sam", text: "We decided to move the realtime service to AWS App Runner so it runs on a persistent container instead of freezing between invocations.", thread: "realtime" },
];

/** Filler chatter (noise / questions / small talk) so the corpus is ~150 msgs. */
const fillerTemplates: string[] = [
  "morning all",
  "standup in 10",
  "lunch?",
  "nice work on that PR",
  "who's reviewing the deploy today",
  "coffee machine is broken again",
  "can someone check the staging env",
  "thanks!",
  "brb",
  "the demo looked great",
  "what time is the sync",
  "did the nightly build pass",
  "pushing a small fix",
  "merging now",
  "on it",
];

export function buildOrbitCorpus(): IngestInput[] {
  const msgs: IngestInput[] = [];

  // Story beats first (deterministic).
  for (const b of beats) {
    msgs.push({
      projectId: PROJECT,
      source: "slack",
      author: b.author,
      text: b.text,
      ts: day(b.week, b.d, b.hour),
      threadKey: b.thread,
      meta: { seed: true },
    });
  }

  // Filler to reach ~150 total, spread across 6 weeks.
  let i = 0;
  while (msgs.length < 150) {
    const week = i % 6;
    const d = i % 7;
    const author = authors[i % authors.length];
    const text = fillerTemplates[i % fillerTemplates.length];
    msgs.push({
      projectId: PROJECT,
      source: "slack",
      author,
      text,
      ts: day(week, d, 9 + (i % 8)),
      meta: { seed: true, filler: true },
    });
    i += 1;
  }

  // Sort chronologically so thread merges behave like the real timeline.
  msgs.sort((a, b) => Date.parse(a.ts!) - Date.parse(b.ts!));
  return msgs;
}

export const ORBIT_PROJECT_ID = PROJECT;
