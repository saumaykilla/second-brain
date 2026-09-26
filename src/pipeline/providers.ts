/**
 * Model + embedding provider seams (A1).
 *
 * The real system routes calls to OpenAI (embeddings + structured extraction) and
 * OpenRouter (cheap classify + strong judge/reflection) per the active harness
 * routing policy (R35). Those SDK calls live behind these interfaces so the
 * pipeline is testable offline: the OfflineProvider below produces deterministic
 * results with zero network access, and the OpenAI/OpenRouter adapters drop in
 * after `npm install`.
 */

import type {
  Attempt,
  Decision,
  Embedding,
  MessageKind,
} from "../types.js";
import { fakeEmbed } from "../fixtures/embedding.js";

/** What extraction produces from a message (before storage/merge). */
export interface ExtractedRecord {
  kind: "attempt" | "decision";
  attempt?: Partial<Attempt>;
  decision?: Partial<Decision>;
}

/** A provider turns prompts + text into classification / extraction / embeddings. */
export interface ModelProvider {
  /** Classify a message using the active harness classify prompt (R7, A1). */
  classify(prompt: string, text: string): Promise<MessageKind>;
  /** Extract a structured attempt/decision using the active extract prompt (R8, A1). */
  extract(
    prompt: string,
    text: string,
    kind: MessageKind
  ): Promise<ExtractedRecord | null>;
  /** Embed text for vector search (R12, R35). */
  embed(text: string): Promise<Embedding>;
}

// ---------------------------------------------------------------------------
// Offline deterministic provider (default in the sandbox / tests)
// ---------------------------------------------------------------------------

/** Keyword classifier — same rules as the S4 placeholder so behavior is stable. */
export function offlineClassify(text: string): MessageKind {
  const t = text.toLowerCase().trim();
  if (/\?\s*$/.test(t) || /^(why|what|how|when|who|where)\b/.test(t))
    return "question";
  if (/\b(decided|we'll use|we will use|going with|switch to|switching to|adopt|adopting|move .* to)\b/.test(t))
    return "decision";
  if (/\b(didn't work|did not work|failed|gave up|giving up|abandoned|dropping|dropped|blocked|couldn't|can't get)\b/.test(t))
    return "attempt_result";
  if (/\b(i'll try|going to try|let me try|attempt|let me add|spike|prototyp|experiment)\b/.test(t))
    return "attempt_start";
  if (/\b(i'm going to|i am going to|about to|planning to|thinking of adding|gonna add|will add)\b/.test(t))
    return "intent";
  if (t.length < 12) return "noise";
  return "intent";
}

const BLOCKER_HINTS: Array<[RegExp, Attempt["blockers"][number]["type"]]> = [
  [/licens/i, "licensing"],
  [/\b(cost|price|expensive|budget)\b/i, "cost"],
  [/\b(slow|latency|p95|performance|timeout|accuracy)\b/i, "performance"],
  [/\b(bug|crash|exception|throws)\b/i, "library_bug"],
  [/\b(serverless|lambda|freeze|can't hold|not supported|unsupported|limit)\b/i, "technical_limit"],
  [/\b(policy|compliance|org|security review)\b/i, "org_constraint"],
  [/\b(deadline|no time|out of time)\b/i, "time"],
];

/** Naive hours extractor: "spent 14 hours", "~9h", "3 days". */
export function extractHours(text: string): number {
  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hours?|hrs?)/i);
  if (h) return Number(h[1]);
  const d = text.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (d) return Number(d[1]) * 8;
  return 0;
}

export function offlineExtract(
  text: string,
  kind: MessageKind
): ExtractedRecord | null {
  if (kind === "decision") {
    return {
      kind: "decision",
      decision: {
        title: text.slice(0, 80),
        rationale: text,
        status: "active",
      },
    };
  }
  if (kind === "attempt_start" || kind === "attempt_result") {
    const outcome: Attempt["outcome"] =
      /\b(abandon|drop|licens)/i.test(text)
        ? "abandoned"
        : /\b(partial|sort of|kind of)\b/i.test(text)
          ? "partially_worked"
          : "failed";
    const blockerType =
      BLOCKER_HINTS.find(([re]) => re.test(text))?.[1] ?? "technical_limit";
    return {
      kind: "attempt",
      attempt: {
        goal: text.slice(0, 100),
        approach: text,
        outcome: kind === "attempt_result" ? outcome : "failed",
        status: "active",
        blockers:
          kind === "attempt_result"
            ? [{ type: blockerType, detail: text }]
            : [],
        hoursSpent: extractHours(text),
      },
    };
  }
  return null;
}

export const offlineProvider: ModelProvider = {
  async classify(_prompt, text) {
    return offlineClassify(text);
  },
  async extract(_prompt, text, kind) {
    return offlineExtract(text, kind);
  },
  async embed(text) {
    return fakeEmbed(text);
  },
};

/**
 * Select the provider. Wire the OpenAI/OpenRouter adapter here once installed;
 * defaults to the offline provider so the pipeline runs with no network / keys.
 */
export function getProvider(): ModelProvider {
  // Placeholder for real routing:
  // if (process.env.OPENAI_API_KEY && process.env.OPENROUTER_API_KEY) {
  //   return createRoutedProvider(getActiveHarness().routing);
  // }
  return offlineProvider;
}
