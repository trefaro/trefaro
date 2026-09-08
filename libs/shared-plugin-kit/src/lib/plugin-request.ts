/**
 * A plug-in's own routes, over `fetch`.
 *
 * **Not** a client's `ApiClient` and not Angular's `HttpClient`: what a client
 * shares with a plug-in bundle are the *models*, never the implementation, and
 * a bundle fetched at runtime carries no second HTTP stack for a handful of
 * calls whose only special need is to read a status code. Three bundles had
 * these lines word for word before they moved here (F138).
 *
 * The `/api` prefix in a caller's path is not guessed: a plug-in's access
 * level is part of its path (E57), so `/api/participant/plugins/<key>/…`,
 * `/api/admin/plugins/<key>/…` and `/api/user/plugins/<key>/…` are contract,
 * not deployment. Both clients are served from the same origin as the API —
 * in production through the reverse proxy, in development through each
 * client's dev-server proxy — which is why the cookie travels and no address
 * of a foreign host appears in any bundle (NFR 9).
 */

/**
 * Raised when the instance says there is no session (401).
 *
 * Its own error class because it is not a failure: a plug-in behind the login
 * is mounted for everybody, so "no session" is a **state it renders** — an
 * invitation to log in — and not something to report as broken (E58).
 */
export class NotSignedInError extends Error {
  constructor() {
    super('No participant session');
    this.name = 'NotSignedInError';
  }
}

/** Anything else the server said no to, with the status for the console. */
export class PluginRequestError extends Error {
  constructor(readonly status: number) {
    super(`The plug-in endpoint answered ${status}`);
    this.name = 'PluginRequestError';
  }
}

export type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A read; the answer as JSON. */
export function readJson<T>(path: string): Promise<T> {
  return pluginRequest<T>(path, { method: 'GET' });
}

/**
 * A write; the answer as JSON, or `undefined` for a `204`.
 *
 * A body is sent only when there is one, so a `DELETE` or an idempotent `PUT`
 * of a pair does not carry an empty object and a content type for nothing.
 */
export function sendJson<T = void>(
  method: WriteMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  return pluginRequest<T>(
    path,
    body === undefined
      ? { method }
      : {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
}

async function pluginRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    // The session is a cookie on `/api`, and the request is same-origin —
    // spelled out rather than left to the default, because this is the line
    // that decides whether the server knows who is asking.
    credentials: 'same-origin',
    // Last, so a caller's content type is kept and neither of these can be
    // dropped by one.
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
  });

  if (response.status === 401) throw new NotSignedInError();
  if (!response.ok) throw new PluginRequestError(response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
