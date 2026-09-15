/** Minimal HTTP helper for the API contract tests. */
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not every endpoint answers with JSON — the plug-in bundles do not.
  }
  return {
    status: response.status,
    body: body as T,
    headers: response.headers,
  };
}

export const postJson = <T = unknown>(path: string, payload: unknown) =>
  api<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

/**
 * The reason a refusal gave, as it travels on the wire (E64).
 *
 * The contract this suite asserts from AP 5 of phase 5 on: a refused request
 * answers with a **code** and its values, never with a sentence. Asserting the
 * code is the second argument for having codes at all — a suite that matched
 * on English prose broke whenever somebody improved the prose, and said nothing
 * when the meaning changed underneath it.
 */
export interface Refusal {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** The refusal in a response body, or `null` when it carries none. */
export function refusalOf(body: unknown): Refusal | null {
  const problem = body as { code?: unknown; params?: unknown } | null;
  if (typeof problem?.code !== 'string') return null;
  const params =
    typeof problem.params === 'object' && problem.params !== null
      ? (problem.params as Record<string, unknown>)
      : {};
  return { code: problem.code, params };
}
