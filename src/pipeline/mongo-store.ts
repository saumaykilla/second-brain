/**
 * MongoDB adapter for BrainStore (A2). Requires `mongodb` (npm install).
 *
 * Same interface as InMemoryStore, backed by Atlas — the system of record (R34).
 * All queries are filtered by projectId to preserve isolation (R1, R14).
 */

import type { Db } from "mongodb";
import { Collections } from "../types.js";
import type {
  Attempt,
  Decision,
  Edge,
  Evidence,
  Message,
} from "../types.js";
import type { BrainStore } from "./store.js";

export class MongoStore implements BrainStore {
  constructor(private db: Db) {}

  async insertMessage(msg: Message): Promise<Message> {
    const res = await this.db.collection(Collections.messages).insertOne(msg as object);
    return { ...msg, _id: String(res.insertedId) };
  }

  async findOpenAttemptByThread(
    projectId: string,
    threadKey: string | undefined
  ): Promise<Attempt | null> {
    if (!threadKey) return null;
    const msgIds = (
      await this.db
        .collection(Collections.messages)
        .find({ projectId, threadKey })
        .project({ _id: 1 })
        .toArray()
    ).map((m) => String(m._id));
    if (msgIds.length === 0) return null;
    return (await this.db.collection<Attempt>(Collections.attempts).findOne({
      projectId,
      status: { $ne: "resolved" },
      sourceMessageIds: { $in: msgIds },
    })) as Attempt | null;
  }

  async findOpenAttemptByAuthor(
    projectId: string,
    author: string,
    withinDays: number,
    beforeIso: string
  ): Promise<Attempt | null> {
    const since = new Date(Date.parse(beforeIso) - withinDays * 864e5).toISOString();
    return (await this.db.collection<Attempt>(Collections.attempts).findOne(
      {
        projectId,
        status: { $ne: "resolved" },
        authors: author,
        createdAt: { $gte: since, $lte: beforeIso },
      },
      { sort: { createdAt: -1 } }
    )) as Attempt | null;
  }

  async upsertAttempt(attempt: Attempt): Promise<Attempt> {
    if (attempt._id) {
      await this.db
        .collection(Collections.attempts)
        .updateOne({ _id: attempt._id as unknown as object }, { $set: attempt as object });
      return attempt;
    }
    const res = await this.db
      .collection(Collections.attempts)
      .insertOne(attempt as object);
    return { ...attempt, _id: String(res.insertedId) };
  }

  async insertDecision(decision: Decision): Promise<Decision> {
    const res = await this.db
      .collection(Collections.decisions)
      .insertOne(decision as object);
    return { ...decision, _id: String(res.insertedId) };
  }

  async insertEvidence(evidence: Evidence): Promise<Evidence> {
    const res = await this.db
      .collection(Collections.evidence)
      .insertOne(evidence as object);
    return { ...evidence, _id: String(res.insertedId) };
  }

  async insertEdge(edge: Edge): Promise<Edge> {
    const res = await this.db.collection(Collections.edges).insertOne(edge as object);
    return { ...edge, _id: String(res.insertedId) };
  }

  async getAttempt(projectId: string, id: string): Promise<Attempt | null> {
    return (await this.db
      .collection<Attempt>(Collections.attempts)
      .findOne({ projectId, _id: id as unknown as object })) as Attempt | null;
  }

  async listAttempts(projectId: string): Promise<Attempt[]> {
    return (await this.db
      .collection<Attempt>(Collections.attempts)
      .find({ projectId })
      .toArray()) as Attempt[];
  }

  async listDecisions(projectId: string): Promise<Decision[]> {
    return (await this.db
      .collection<Decision>(Collections.decisions)
      .find({ projectId })
      .toArray()) as Decision[];
  }
}
