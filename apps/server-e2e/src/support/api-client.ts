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
