/**
 * Deterministic offline embedding (fixtures only).
 *
 * The real system uses OpenAI embeddings (R35). For hand-written fixtures we need
 * vectors that are (a) reproducible without network access and (b) reflect lexical
 * similarity well enough that "socket.io realtime" lands near the WebSockets dead
 * end while an unrelated idea does not. This is a hashed bag-of-words projection:
 * NOT for production, only to make fixtures self-contained and testable.
 */

const DIMS = 1536;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

/** FNV-1a hash → stable per-token seed. */
function hash(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic unit-length embedding for a piece of text. */
export function fakeEmbed(text: string): number[] {
  const vec = new Array<number>(DIMS).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const seed = hash(token);
    // spread each token across 3 dimensions so near-synonyms overlap softly
    for (let j = 0; j < 3; j++) {
      const idx = (seed + j * 2654435761) % DIMS;
      const sign = ((seed >> j) & 1) === 0 ? 1 : -1;
      vec[idx] += sign;
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export const EMBED_DIMS = DIMS;
