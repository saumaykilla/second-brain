/**
 * Minimal dependency-free HTTP contract (A6).
 *
 * The Next.js app / Node API mounts these handlers on real routes. Keeping a
 * framework-agnostic request/response shape lets the handlers be unit-tested with
 * no server and dropped into Next route handlers, Express, or a Lambda adapter.
 */

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  /** Raw body string (needed for webhook signature verification). */
  rawBody: string;
  /** Parsed JSON body when applicable. */
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export type ApiHandler = (req: ApiRequest) => Promise<ApiResponse>;

export function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

/** Parse rawBody as JSON, tolerating already-parsed body. */
export function parseJson(req: ApiRequest): unknown {
  if (req.body !== undefined) return req.body;
  if (!req.rawBody) return undefined;
  try {
    return JSON.parse(req.rawBody);
  } catch {
    return undefined;
  }
}
