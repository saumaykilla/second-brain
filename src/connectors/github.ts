/**
 * GitHub connector (A4).
 *
 * Turns durable signals of failed/abandoned work into pipeline messages (R7):
 *   - a CLOSED (not merged) pull request  → attempt_result (approach dropped)
 *   - a "revert" commit / PR title        → attempt_result (approach backed out)
 *   - an issue closed as "wontfix"        → attempt_result (abandoned)
 *   - a MERGED pull request               → decision (the team committed to this)
 *
 * Verifies the `X-Hub-Signature-256` HMAC. Provides a backfill helper that pages
 * closed PRs and wontfix issues through the same pipeline. Dependency-free.
 */

import { hmacSha256Hex, timingSafeEqual } from "./crypto.js";
import { ingestMessage } from "../pipeline/index.js";
import type { IngestResult } from "../types.js";
import { json, parseJson, type ApiHandler, type ApiRequest } from "../api/router.js";

/** Verify GitHub's `X-Hub-Signature-256: sha256=<hex>` header. */
export function verifyGithubSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const expected = `sha256=${hmacSha256Hex(secret, rawBody)}`;
  return timingSafeEqual(expected, signatureHeader);
}

export function isRevert(title: string): boolean {
  return /^revert\b|\brevert(s|ed)?\b/i.test(title);
}

// --- Event payload shapes (only the fields we use) -----------------------

export interface GithubPullRequest {
  number: number;
  title: string;
  body?: string;
  user?: { login: string };
  merged?: boolean;
  html_url?: string;
  updated_at?: string;
}

export interface GithubIssue {
  number: number;
  title: string;
  body?: string;
  user?: { login: string };
  state_reason?: string; // "completed" | "not_planned" | "reopened"
  labels?: Array<{ name: string }>;
  html_url?: string;
  updated_at?: string;
}

type IngestReturn = IngestResult & { trace: string[] };

function tsOrNow(iso?: string): string {
  return iso ?? new Date().toISOString();
}

/** Map a closed pull_request event to a pipeline ingest (A4). */
export async function ingestPullRequest(
  projectId: string,
  action: string,
  pr: GithubPullRequest
): Promise<IngestReturn | null> {
  if (action !== "closed") return null;
  const author = pr.user?.login ?? "github";
  const threadKey = `pr-${pr.number}`;
  const meta = { pr: pr.number, url: pr.html_url };

  if (pr.merged) {
    // A merged PR is a decision the team committed to.
    return ingestMessage({
      projectId,
      source: "github",
      author,
      text: `We decided to merge PR #${pr.number}: ${pr.title}. ${pr.body ?? ""}`.trim(),
      ts: tsOrNow(pr.updated_at),
      threadKey,
      meta: { ...meta, kind: "merged_pr" },
    });
  }

  // Closed-without-merge = an approach that was dropped.
  const revert = isRevert(pr.title);
  const verb = revert ? "reverted" : "closed without merging";
  return ingestMessage({
    projectId,
    source: "github",
    author,
    text: `We ${verb} PR #${pr.number}: ${pr.title}. This approach was dropped. ${pr.body ?? ""}`.trim(),
    ts: tsOrNow(pr.updated_at),
    threadKey,
    meta: { ...meta, kind: revert ? "revert_pr" : "closed_pr" },
  });
}

/** Map a "wontfix"/"not_planned" closed issue to an abandoned attempt (A4). */
export async function ingestIssue(
  projectId: string,
  action: string,
  issue: GithubIssue
): Promise<IngestReturn | null> {
  if (action !== "closed") return null;
  const labels = (issue.labels ?? []).map((l) => l.name.toLowerCase());
  const wontfix =
    issue.state_reason === "not_planned" ||
    labels.includes("wontfix") ||
    labels.includes("won't fix");
  if (!wontfix) return null;

  return ingestMessage({
    projectId,
    source: "github",
    author: issue.user?.login ?? "github",
    text: `We abandoned issue #${issue.number}: ${issue.title}. Marked wontfix. ${issue.body ?? ""}`.trim(),
    ts: tsOrNow(issue.updated_at),
    threadKey: `issue-${issue.number}`,
    meta: { issue: issue.number, url: issue.html_url, kind: "wontfix_issue" },
  });
}

/** Backfill closed PRs and wontfix issues through the pipeline (A4). */
export async function backfillGithub(
  projectId: string,
  data: { pullRequests?: GithubPullRequest[]; issues?: GithubIssue[] }
): Promise<{ prs: number; issues: number }> {
  let prs = 0;
  let issues = 0;
  for (const pr of data.pullRequests ?? []) {
    const r = await ingestPullRequest(projectId, "closed", pr);
    if (r) prs += 1;
  }
  for (const issue of data.issues ?? []) {
    const r = await ingestIssue(projectId, "closed", issue);
    if (r) issues += 1;
  }
  return { prs, issues };
}

/** GitHub webhook handler (A4). Routes pull_request and issues events. */
export function makeGithubWebhookHandler(opts: {
  projectId: string;
  webhookSecret: string;
}): ApiHandler {
  return async (req: ApiRequest) => {
    const sig = req.headers["x-hub-signature-256"] ?? "";
    if (!verifyGithubSignature(opts.webhookSecret, req.rawBody, sig)) {
      return json(401, { error: "bad signature" });
    }
    const event = req.headers["x-github-event"] ?? "";
    const body = (parseJson(req) ?? {}) as {
      action?: string;
      pull_request?: GithubPullRequest;
      issue?: GithubIssue;
    };
    const action = body.action ?? "";

    if (event === "pull_request" && body.pull_request) {
      const r = await ingestPullRequest(opts.projectId, action, body.pull_request);
      return json(200, { ok: true, ingested: !!r, kind: r?.kind ?? null });
    }
    if (event === "issues" && body.issue) {
      const r = await ingestIssue(opts.projectId, action, body.issue);
      return json(200, { ok: true, ingested: !!r, kind: r?.kind ?? null });
    }
    return json(200, { ok: true, ignored: event });
  };
}
