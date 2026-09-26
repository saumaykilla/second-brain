/**
 * CI + logs connector (A5).
 *
 * - Handles GitHub `workflow_run` webhooks. A FAILED workflow run is a signal
 *   that an approach didn't work; its logs become evidence (R4).
 * - `saveCiLogEvidence` fetches the failing logs (from CloudWatch in prod),
 *   writes them to object storage (S3), and creates an Evidence record linked
 *   to the attempt (R4, f-aws-02).
 *
 * The log source and object store are seams so this runs offline in tests.
 */

import { hmacSha256Hex, timingSafeEqual } from "./crypto.js";
import type { BrainStore } from "../pipeline/store.js";
import type { EvidenceStore } from "./evidence-store.js";
import type { Evidence } from "../types.js";
import { json, parseJson, type ApiHandler, type ApiRequest } from "../api/router.js";

/** Verify GitHub's `X-Hub-Signature-256` (shared scheme with A4). */
export function verifyCiSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const expected = `sha256=${hmacSha256Hex(secret, rawBody)}`;
  return timingSafeEqual(expected, signatureHeader);
}

export interface WorkflowRun {
  id: number;
  name?: string;
  head_branch?: string;
  head_sha?: string;
  conclusion?: string; // "success" | "failure" | "cancelled" | ...
  html_url?: string;
  updated_at?: string;
}

/** A log source returns the failing log text for a workflow run (CloudWatch in prod). */
export interface LogSource {
  fetchFailingLog(run: WorkflowRun): Promise<string>;
}

/** Offline log source: returns a synthetic failing log. */
export const stubLogSource: LogSource = {
  async fetchFailingLog(run) {
    return `workflow "${run.name ?? "ci"}" run ${run.id} failed on ${run.head_sha ?? "?"}\n[stub log excerpt]`;
  },
};

/**
 * Save a failing CI run's log as evidence linked to an attempt (A5, R4).
 * Fetches the log, stores it in object storage, and writes an Evidence record.
 */
export async function saveCiLogEvidence(args: {
  projectId: string;
  attemptId: string;
  run: WorkflowRun;
  store: BrainStore;
  evidenceStore: EvidenceStore;
  logSource: LogSource;
}): Promise<Evidence> {
  const log = await args.logSource.fetchFailingLog(args.run);
  const key = `${args.projectId}/ci/${args.run.id}.log`;
  const storageKey = await args.evidenceStore.put(key, log, "text/plain");
  const now = new Date().toISOString();

  const evidence: Evidence = {
    projectId: args.projectId,
    kind: "log_excerpt",
    title: `CI failure: ${args.run.name ?? "workflow"} run ${args.run.id}`,
    content: log.slice(0, 2000),
    url: args.evidenceStore.url(storageKey),
    storageKey,
    subjectId: args.attemptId,
    subjectType: "attempt",
    createdAt: now,
    updatedAt: now,
  };
  const stored = await args.store.insertEvidence(evidence);

  // Attach the evidence id to the attempt so it opens from the dead-end record.
  const attempt = await args.store.getAttempt(args.projectId, args.attemptId);
  if (attempt) {
    attempt.evidenceIds = [...attempt.evidenceIds, stored._id!];
    attempt.updatedAt = now;
    await args.store.upsertAttempt(attempt);
  }
  return stored;
}

/** `workflow_run` webhook handler (A5). */
export function makeWorkflowRunHandler(opts: {
  projectId: string;
  webhookSecret: string;
  store: BrainStore;
  evidenceStore: EvidenceStore;
  logSource?: LogSource;
  /** Resolve which attempt a failing run relates to (e.g. by branch/PR). */
  resolveAttemptId?: (run: WorkflowRun) => Promise<string | null>;
}): ApiHandler {
  return async (req: ApiRequest) => {
    const sig = req.headers["x-hub-signature-256"] ?? "";
    if (!verifyCiSignature(opts.webhookSecret, req.rawBody, sig)) {
      return json(401, { error: "bad signature" });
    }
    const event = req.headers["x-github-event"] ?? "";
    if (event !== "workflow_run") return json(200, { ok: true, ignored: event });

    const body = (parseJson(req) ?? {}) as {
      action?: string;
      workflow_run?: WorkflowRun;
    };
    const run = body.workflow_run;
    if (body.action !== "completed" || !run) {
      return json(200, { ok: true, ignored: body.action });
    }
    if (run.conclusion !== "failure") {
      return json(200, { ok: true, conclusion: run.conclusion });
    }

    const attemptId = opts.resolveAttemptId
      ? await opts.resolveAttemptId(run)
      : null;
    if (!attemptId) {
      // No attempt to attach to yet; acknowledge without creating orphan evidence.
      return json(200, { ok: true, note: "failure noted, no linked attempt" });
    }

    const ev = await saveCiLogEvidence({
      projectId: opts.projectId,
      attemptId,
      run,
      store: opts.store,
      evidenceStore: opts.evidenceStore,
      logSource: opts.logSource ?? stubLogSource,
    });
    return json(200, { ok: true, evidenceId: ev._id });
  };
}
