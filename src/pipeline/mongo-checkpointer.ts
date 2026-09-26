/**
 * MongoDB checkpoint saver (A2). Requires `mongodb` (npm install).
 *
 * Stores LangGraph checkpoints in MongoDB, not a worker-local file (R34). In
 * production prefer the official @langchain/langgraph-checkpoint-mongodb
 * MongoDBSaver; this lightweight adapter satisfies the same Checkpointer seam
 * used by the framework-light runner in graph.ts.
 */

import type { Db } from "mongodb";
import { Collections } from "../types.js";
import type { Checkpoint, Checkpointer } from "./checkpointer.js";

export class MongoCheckpointer implements Checkpointer {
  constructor(private db: Db) {}

  async put<S>(threadId: string, node: string, state: S): Promise<void> {
    await this.db.collection(Collections.checkpoints).insertOne({
      threadId,
      node,
      state,
      ts: new Date().toISOString(),
    });
  }

  async latest<S>(threadId: string): Promise<Checkpoint<S> | null> {
    const doc = await this.db
      .collection(Collections.checkpoints)
      .findOne({ threadId }, { sort: { ts: -1 } });
    return (doc as unknown as Checkpoint<S>) ?? null;
  }

  async list(threadId: string): Promise<Checkpoint[]> {
    return (await this.db
      .collection(Collections.checkpoints)
      .find({ threadId })
      .sort({ ts: 1 })
      .toArray()) as unknown as Checkpoint[];
  }
}
