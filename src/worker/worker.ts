/**
 * Background worker entrypoint (A8, f-aws-02).
 *
 * Processes capture/backfill jobs outside the web request. Runs the same
 * pipeline as the API. In production this is the App Runner service / Lambda
 * handler; here `processOnce` and `runWorkerLoop` are the testable core.
 */

import type { IngestInput } from "../types.js";
import { ingestMessage } from "../pipeline/index.js";
import type { Job, JobQueue } from "./queue.js";

export interface CapturePayload {
  input: IngestInput;
}

export interface BackfillPayload {
  inputs: IngestInput[];
}

export interface WorkerResult {
  processed: number;
  lastJobId?: string;
}

/** Process a single job. Returns how many messages it ingested. */
export async function processJob(job: Job): Promise<number> {
  switch (job.type) {
    case "capture": {
      const p = job.payload as CapturePayload;
      await ingestMessage(p.input);
      return 1;
    }
    case "backfill": {
      const p = job.payload as BackfillPayload;
      for (const input of p.inputs) await ingestMessage(input);
      return p.inputs.length;
    }
    case "reflection":
      // Reflection runs in Person 2's harness feature; the worker just routes it.
      return 0;
    default:
      return 0;
  }
}

/** Drain the queue once (single worker tick). */
export async function processOnce(queue: JobQueue): Promise<WorkerResult> {
  let processed = 0;
  let lastJobId: string | undefined;
  let job = await queue.dequeue();
  while (job) {
    processed += await processJob(job);
    lastJobId = job.id;
    job = await queue.dequeue();
  }
  return { processed, lastJobId };
}

/**
 * Lambda-style handler: process a batch of records then return.
 * (App Runner would call processOnce on a loop / SQS trigger instead.)
 */
export async function handler(event: {
  Records?: Array<{ body: string }>;
}): Promise<WorkerResult> {
  let processed = 0;
  for (const record of event.Records ?? []) {
    const job = JSON.parse(record.body) as Job;
    processed += await processJob(job);
  }
  return { processed };
}
