/**
 * Linear time-logs connector (A9, optional).
 *
 * Feeds real engineer-hours into an attempt's `hoursSpent`, which drives the
 * "hours saved" figure on warnings (R13, R21). Linear issues are matched to
 * attempts (by an explicit mapping the caller supplies), and their logged time
 * is summed into the attempt.
 *
 * The Linear API call is a seam (LinearTimeSource); an offline stub is provided.
 */

import type { BrainStore } from "../pipeline/store.js";

export interface LinearTimeLog {
  issueId: string;
  /** Hours logged against the issue. */
  hours: number;
  author?: string;
  loggedAt?: string;
}

export interface LinearTimeSource {
  /** Fetch time logs for a set of Linear issue ids. */
  fetchTimeLogs(issueIds: string[]): Promise<LinearTimeLog[]>;
}

/** Offline stub source. */
export function stubLinearSource(logs: LinearTimeLog[]): LinearTimeSource {
  return {
    async fetchTimeLogs(issueIds) {
      return logs.filter((l) => issueIds.includes(l.issueId));
    },
  };
}

/**
 * Apply Linear time logs to attempts (A9).
 * `issueToAttempt` maps a Linear issue id → an attempt id in the project.
 * Sets each attempt's hoursSpent to the summed logged time.
 */
export async function applyLinearHours(args: {
  projectId: string;
  issueToAttempt: Record<string, string>;
  source: LinearTimeSource;
  store: BrainStore;
}): Promise<Array<{ attemptId: string; hours: number }>> {
  const issueIds = Object.keys(args.issueToAttempt);
  const logs = await args.source.fetchTimeLogs(issueIds);

  // Sum hours per attempt.
  const perAttempt = new Map<string, number>();
  for (const log of logs) {
    const attemptId = args.issueToAttempt[log.issueId];
    if (!attemptId) continue;
    perAttempt.set(attemptId, (perAttempt.get(attemptId) ?? 0) + log.hours);
  }

  const updated: Array<{ attemptId: string; hours: number }> = [];
  for (const [attemptId, hours] of perAttempt) {
    const attempt = await args.store.getAttempt(args.projectId, attemptId);
    if (!attempt) continue;
    attempt.hoursSpent = hours;
    attempt.updatedAt = new Date().toISOString();
    await args.store.upsertAttempt(attempt);
    updated.push({ attemptId, hours });
  }
  return updated;
}
