/**
 * Storage seam (A2).
 *
 * The system of record is MongoDB Atlas (R34). The pipeline talks to this
 * interface so it can run against an in-memory store offline (tests, sandbox)
 * and against Atlas in production. The MongoStore adapter (src/pipeline/mongo-store.ts)
 * implements the same interface using the `mongodb` driver.
 */

import type {
  Attempt,
  Decision,
  Edge,
  Evidence,
  Message,
} from "../types.js";

export interface BrainStore {
  insertMessage(msg: Message): Promise<Message>;
  /** Find an open attempt in the same thread to merge into (R9). */
  findOpenAttemptByThread(
    projectId: string,
    threadKey: string | undefined
  ): Promise<Attempt | null>;
  /** Find a recent open attempt by the same author within `days` (R9). */
  findOpenAttemptByAuthor(
    projectId: string,
    author: string,
    withinDays: number,
    beforeIso: string
  ): Promise<Attempt | null>;
  upsertAttempt(attempt: Attempt): Promise<Attempt>;
  insertDecision(decision: Decision): Promise<Decision>;
  insertEvidence(evidence: Evidence): Promise<Evidence>;
  insertEdge(edge: Edge): Promise<Edge>;
  getAttempt(projectId: string, id: string): Promise<Attempt | null>;
  listAttempts(projectId: string): Promise<Attempt[]>;
  listDecisions(projectId: string): Promise<Decision[]>;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Dependency-free in-memory store for offline runs and tests. */
export class InMemoryStore implements BrainStore {
  messages: Message[] = [];
  attempts: Attempt[] = [];
  decisions: Decision[] = [];
  evidence: Evidence[] = [];
  edges: Edge[] = [];

  async insertMessage(msg: Message): Promise<Message> {
    const stored = { ...msg, _id: msg._id ?? nextId("msg") };
    this.messages.push(stored);
    return stored;
  }

  async findOpenAttemptByThread(
    projectId: string,
    threadKey: string | undefined
  ): Promise<Attempt | null> {
    if (!threadKey) return null;
    return (
      this.attempts.find(
        (a) =>
          a.projectId === projectId &&
          a.status !== "resolved" &&
          a.sourceMessageIds.some((mid) =>
            this.messages.find(
              (m) => m._id === mid && m.threadKey === threadKey
            )
          )
      ) ?? null
    );
  }

  async findOpenAttemptByAuthor(
    projectId: string,
    author: string,
    withinDays: number,
    beforeIso: string
  ): Promise<Attempt | null> {
    const before = Date.parse(beforeIso);
    const windowMs = withinDays * 24 * 3600 * 1000;
    return (
      this.attempts.find(
        (a) =>
          a.projectId === projectId &&
          a.status !== "resolved" &&
          a.authors.includes(author) &&
          before - Date.parse(a.createdAt) <= windowMs &&
          before - Date.parse(a.createdAt) >= 0
      ) ?? null
    );
  }

  async upsertAttempt(attempt: Attempt): Promise<Attempt> {
    const idx = attempt._id
      ? this.attempts.findIndex((a) => a._id === attempt._id)
      : -1;
    if (idx >= 0) {
      this.attempts[idx] = attempt;
      return attempt;
    }
    const stored = { ...attempt, _id: attempt._id ?? nextId("att") };
    this.attempts.push(stored);
    return stored;
  }

  async insertDecision(decision: Decision): Promise<Decision> {
    const stored = { ...decision, _id: decision._id ?? nextId("dec") };
    this.decisions.push(stored);
    return stored;
  }

  async insertEvidence(evidence: Evidence): Promise<Evidence> {
    const stored = { ...evidence, _id: evidence._id ?? nextId("ev") };
    this.evidence.push(stored);
    return stored;
  }

  async insertEdge(edge: Edge): Promise<Edge> {
    const stored = { ...edge, _id: edge._id ?? nextId("edge") };
    this.edges.push(stored);
    return stored;
  }

  async getAttempt(projectId: string, id: string): Promise<Attempt | null> {
    return (
      this.attempts.find((a) => a.projectId === projectId && a._id === id) ??
      null
    );
  }

  async listAttempts(projectId: string): Promise<Attempt[]> {
    return this.attempts.filter((a) => a.projectId === projectId);
  }

  async listDecisions(projectId: string): Promise<Decision[]> {
    return this.decisions.filter((d) => d.projectId === projectId);
  }
}
