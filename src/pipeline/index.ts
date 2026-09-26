/**
 * Pipeline entry point + dependency assembly (A1, A2).
 *
 * `ingestMessage()` is the real implementation behind the shared `ingest()`
 * contract (S1/S4). It runs a message through the classify → extract →
 * merge_attempt → embed_and_store → link graph and returns the IngestResult.
 *
 * By default it uses offline deps (in-memory store + checkpointer + deterministic
 * provider) so it runs with no network. Pass Atlas-backed deps in production.
 */

import type { HarnessConfig, IngestInput, IngestResult } from "../types.js";
import { getProvider, offlineProvider, type ModelProvider } from "./providers.js";
import { InMemoryStore, type BrainStore } from "./store.js";
import { InMemoryCheckpointer, type Checkpointer } from "./checkpointer.js";
import { runPipeline, type PipelineDeps } from "./graph.js";
import { harnessV1 } from "../fixtures/orbit.js";

export interface IngestOptions {
  provider?: ModelProvider;
  store?: BrainStore;
  checkpointer?: Checkpointer;
  harness?: HarnessConfig;
}

/** Build a default, fully-offline set of pipeline deps (shared across calls). */
let defaultStore: InMemoryStore | null = null;
let defaultCheckpointer: InMemoryCheckpointer | null = null;

export function defaultDeps(overrides: IngestOptions = {}): PipelineDeps {
  defaultStore ??= new InMemoryStore();
  defaultCheckpointer ??= new InMemoryCheckpointer();
  return {
    provider: overrides.provider ?? offlineProvider ?? getProvider(),
    store: overrides.store ?? defaultStore,
    checkpointer: overrides.checkpointer ?? defaultCheckpointer,
    harness: overrides.harness ?? harnessV1,
  };
}

/** Run a message through the real pipeline. */
export async function ingestMessage(
  input: IngestInput,
  options: IngestOptions = {}
): Promise<IngestResult & { trace: string[] }> {
  const deps = defaultDeps(options);
  return runPipeline(
    {
      projectId: input.projectId,
      source: input.source,
      author: input.author,
      text: input.text,
      ts: input.ts ?? new Date().toISOString(),
      threadKey: input.threadKey,
      meta: input.meta,
    },
    deps
  );
}

export { runPipeline } from "./graph.js";
export type { PipelineDeps, PipelineInput } from "./graph.js";
export * from "./providers.js";
export * from "./store.js";
export * from "./checkpointer.js";
