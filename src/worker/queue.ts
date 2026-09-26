/**
 * Job queue seam (A8).
 *
 * Web handlers should acknowledge fast and hand heavy work (extraction, embedding,
 * backfill) to a background worker rather than doing it in the request (f-aws-02).
 * This interface lets the worker run against an in-memory queue offline and against
 * SQS / EventBridge in production.
 */

export type JobType = "capture" | "backfill" | "reflection";

export interface Job<P = unknown> {
  id: string;
  type: JobType;
  payload: P;
  enqueuedAt: string;
}

export interface JobQueue {
  enqueue<P>(type: JobType, payload: P): Promise<Job<P>>;
  /** Pull the next job, or null if empty. */
  dequeue(): Promise<Job | null>;
  size(): number;
}

let jobSeq = 0;

export class InMemoryQueue implements JobQueue {
  private jobs: Job[] = [];

  async enqueue<P>(type: JobType, payload: P): Promise<Job<P>> {
    jobSeq += 1;
    const job: Job<P> = {
      id: `job_${Date.now().toString(36)}_${jobSeq}`,
      type,
      payload,
      enqueuedAt: new Date().toISOString(),
    };
    this.jobs.push(job as Job);
    return job;
  }

  async dequeue(): Promise<Job | null> {
    return this.jobs.shift() ?? null;
  }

  size(): number {
    return this.jobs.length;
  }
}
