/**
 * Manual capture API — POST /api/capture (A6).
 *
 * Accepts a web-captured message and runs it through the real pipeline (A1/A2),
 * returning the structured result. This is Flow F1 / the manual side of R7.
 * Depends only on the pipeline entry point, so it works offline.
 */

import type { IngestInput, MessageSource } from "../types.js";
import { ingestMessage } from "../pipeline/index.js";
import { json, parseJson, type ApiHandler, type ApiRequest } from "./router.js";

interface CaptureBody {
  projectId?: string;
  source?: MessageSource;
  author?: string;
  text?: string;
  ts?: string;
  threadKey?: string;
  meta?: Record<string, unknown>;
}

export const captureHandler: ApiHandler = async (req: ApiRequest) => {
  if (req.method.toUpperCase() !== "POST") {
    return json(405, { error: "method not allowed" });
  }
  const body = (parseJson(req) ?? {}) as CaptureBody;

  if (!body.projectId || !body.text || !body.author) {
    return json(400, {
      error: "projectId, author, and text are required",
    });
  }

  const input: IngestInput = {
    projectId: body.projectId,
    source: body.source ?? "web",
    author: body.author,
    text: body.text,
    ts: body.ts,
    threadKey: body.threadKey,
    meta: body.meta,
  };

  const result = await ingestMessage(input);
  return json(201, {
    messageId: result.message._id,
    kind: result.kind,
    merged: result.merged,
    attemptId: result.attempt?._id ?? null,
    decisionId: result.decision?._id ?? null,
    trace: result.trace,
  });
};
