/**
 * Slack connector (A3).
 *
 * - Verifies the Slack request signature (v0 HMAC scheme).
 * - Handles Events API `message` events → ingest through the pipeline (R7).
 * - Backfills channel history through the same pipeline.
 * - Handles the `/brain deadend` slash command: runs checkDeadEnds and, on a
 *   match, returns a threaded warning with blocker, evidence, alternative, and
 *   hours saved (R13, F2). Uses the fake checkDeadEnds until Person 2's real
 *   version exists (S4).
 *
 * Dependency-free: the pipeline + shared functions are offline-capable.
 */

import { hmacSha256Hex, timingSafeEqual } from "./crypto.js";
import { ingestMessage } from "../pipeline/index.js";
import { checkDeadEnds } from "../shared/index.js";
import type { CheckDeadEndsResult, IngestResult } from "../types.js";
import { json, parseJson, type ApiHandler, type ApiRequest } from "../api/router.js";

/** Read one field from an application/x-www-form-urlencoded body (dependency-free). */
export function parseFormField(rawBody: string, field: string): string | null {
  for (const pair of rawBody.split("&")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const key = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, " "));
    if (key === field) {
      return decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
    }
  }
  return null;
}

/** Verify `X-Slack-Signature` against `X-Slack-Request-Timestamp` + body. */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  // Reject replays older than 5 minutes.
  if (Math.abs(nowSeconds - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${hmacSha256Hex(signingSecret, base)}`;
  return timingSafeEqual(expected, signature);
}

export interface SlackMessageEvent {
  type: "message";
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

/** Map a Slack message event onto a pipeline ingest. */
export async function ingestSlackMessage(
  projectId: string,
  event: SlackMessageEvent
): Promise<IngestResult & { trace: string[] }> {
  return ingestMessage({
    projectId,
    source: "slack",
    author: event.user,
    text: event.text,
    ts: new Date(Number(event.ts.split(".")[0]) * 1000).toISOString(),
    threadKey: event.thread_ts ?? event.ts,
    meta: { channel: event.channel, slackTs: event.ts },
  });
}

/** Backfill a batch of historical Slack messages through the pipeline. */
export async function backfillSlack(
  projectId: string,
  events: SlackMessageEvent[]
): Promise<number> {
  let processed = 0;
  for (const e of events) {
    await ingestSlackMessage(projectId, e);
    processed += 1;
  }
  return processed;
}

/** Format a checkDeadEnds result as a Slack thread reply (R13). */
export function formatWarning(result: CheckDeadEndsResult): string | null {
  if (result.matches.length === 0) return null;
  const m = result.matches[0];
  const blocker = m.attempt.blockers[0];
  const ev = m.evidence[0];
  return [
    `:warning: *Heads up — this looks like a dead end we already hit* (confidence ${(m.confidence * 100).toFixed(0)}%)`,
    `> *Tried:* ${m.attempt.approach}`,
    blocker ? `> *Why it failed (${blocker.type}):* ${blocker.detail}` : "",
    ev ? `> *Evidence:* ${ev.title}${ev.url ? ` — ${ev.url}` : ""}` : "",
    m.attempt.alternative ? `> *What we did instead:* ${m.attempt.alternative}` : "",
    `> *Estimated hours saved:* ${m.hoursSaved}h`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Slack Events API webhook handler (A3).
 * Handles url_verification challenge, message events, and returns 200 fast.
 */
export function makeSlackEventsHandler(opts: {
  projectId: string;
  signingSecret: string;
  proactiveWarnings?: boolean;
}): ApiHandler {
  return async (req: ApiRequest) => {
    const ts = req.headers["x-slack-request-timestamp"] ?? "";
    const sig = req.headers["x-slack-signature"] ?? "";
    if (!verifySlackSignature(opts.signingSecret, ts, req.rawBody, sig)) {
      return json(401, { error: "bad signature" });
    }
    const body = (parseJson(req) ?? {}) as {
      type?: string;
      challenge?: string;
      event?: SlackMessageEvent;
    };

    if (body.type === "url_verification") {
      return json(200, { challenge: body.challenge });
    }

    if (body.event?.type === "message" && body.event.text) {
      const result = await ingestSlackMessage(opts.projectId, body.event);
      // Proactive warning when the message states an intent (F2, R11-R13).
      if (opts.proactiveWarnings && result.kind === "intent") {
        const dead = await checkDeadEnds({
          projectId: opts.projectId,
          text: body.event.text,
        });
        const warning = formatWarning(dead);
        if (warning) {
          return json(200, {
            ok: true,
            postThread: { thread_ts: body.event.thread_ts ?? body.event.ts, text: warning },
          });
        }
      }
      return json(200, { ok: true, kind: result.kind });
    }

    return json(200, { ok: true });
  };
}

/** `/brain deadend <plan>` slash command handler (A3). */
export function makeBrainSlashHandler(opts: {
  projectId: string;
  signingSecret: string;
}): ApiHandler {
  return async (req: ApiRequest) => {
    const ts = req.headers["x-slack-request-timestamp"] ?? "";
    const sig = req.headers["x-slack-signature"] ?? "";
    if (!verifySlackSignature(opts.signingSecret, ts, req.rawBody, sig)) {
      return json(401, { error: "bad signature" });
    }
    // Slash commands arrive form-encoded: command=/brain&text=deadend ...
    const text = parseFormField(req.rawBody, "text") ?? "";
    const [sub, ...rest] = text.trim().split(/\s+/);
    if (sub !== "deadend") {
      return json(200, {
        response_type: "ephemeral",
        text: "Usage: `/brain deadend <describe your plan>`",
      });
    }
    const plan = rest.join(" ");
    const dead = await checkDeadEnds({ projectId: opts.projectId, text: plan });
    const warning = formatWarning(dead);
    return json(200, {
      response_type: warning ? "in_channel" : "ephemeral",
      text:
        warning ??
        ":white_check_mark: No matching dead end — this looks like a genuinely new approach.",
    });
  };
}
