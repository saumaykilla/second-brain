/**
 * Checkpoint saver seam (A2).
 *
 * LangGraph persists graph checkpoints so a run can resume and so each node's
 * work is durable. Per R34 these checkpoints live in MongoDB (the MongoDBSaver),
 * NOT in a worker-local file. This interface lets the graph run with an in-memory
 * saver offline and the real @langchain/langgraph-checkpoint-mongodb MongoDBSaver
 * in production (drop-in via MongoCheckpointer).
 */

export interface Checkpoint<S = unknown> {
  threadId: string;
  node: string;
  state: S;
  ts: string;
}

export interface Checkpointer {
  /** Persist the state after a node runs. */
  put<S>(threadId: string, node: string, state: S): Promise<void>;
  /** Load the latest checkpoint for a thread, if any (for resume). */
  latest<S>(threadId: string): Promise<Checkpoint<S> | null>;
  list(threadId: string): Promise<Checkpoint[]>;
}

export class InMemoryCheckpointer implements Checkpointer {
  private store = new Map<string, Checkpoint[]>();

  async put<S>(threadId: string, node: string, state: S): Promise<void> {
    const list = this.store.get(threadId) ?? [];
    list.push({ threadId, node, state, ts: new Date().toISOString() });
    this.store.set(threadId, list);
  }

  async latest<S>(threadId: string): Promise<Checkpoint<S> | null> {
    const list = this.store.get(threadId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1] as Checkpoint<S>;
  }

  async list(threadId: string): Promise<Checkpoint[]> {
    return this.store.get(threadId) ?? [];
  }
}
