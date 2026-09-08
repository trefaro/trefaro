import {
  NotSignedInError,
  PluginRequestError,
  readJson,
  sendJson,
} from './plugin-request';

/** What `fetch` was asked, so the test can read the request that went out. */
interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

function answering(status: number, body?: unknown): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return sent;
}

/**
 * A plug-in's own routes, over `fetch` — the lines every bundle needs (F138).
 *
 * What the three bundles had in common, and what is held on to here: the
 * session travels (same-origin, cookie), a 401 is its own error because it is
 * a **state** a plug-in renders rather than a failure (E58), everything else
 * the server refused carries its status for the console, and a `204` is an
 * answer without a body.
 */
describe('a plug-in request', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends the cookie with a same-origin request and asks for JSON', async () => {
    const sent = answering(200, { rows: [] });

    await readJson('/api/participant/plugins/forum/events/e/threads');

    expect(sent[0].init.credentials).toBe('same-origin');
    expect(sent[0].init.method).toBe('GET');
    expect(sent[0].init.headers).toMatchObject({ accept: 'application/json' });
  });

  it('returns the body as JSON', async () => {
    answering(200, { total: 3 });

    expect(await readJson<{ total: number }>('/api/x')).toEqual({ total: 3 });
  });

  it('writes a JSON body with the method it was given, keeping the content type', async () => {
    const sent = answering(201, { id: 'room-1' });

    const answer = await sendJson<{ id: string }>('POST', '/api/x', {
      name: 'Room A',
    });

    expect(answer).toEqual({ id: 'room-1' });
    expect(sent[0].init.method).toBe('POST');
    expect(sent[0].init.body).toBe('{"name":"Room A"}');
    expect(sent[0].init.headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
    });
  });

  it('sends no body for a method without one, and reads none from a 204', async () => {
    const sent = answering(204);

    await expect(sendJson('DELETE', '/api/x')).resolves.toBeUndefined();

    expect(sent[0].init.body).toBeUndefined();
    expect(sent[0].init.headers).not.toHaveProperty('content-type');
  });

  it('turns a 401 into the one error a bundle renders as a state (E58)', async () => {
    answering(401, { message: 'Unauthorized' });

    await expect(readJson('/api/x')).rejects.toBeInstanceOf(NotSignedInError);
  });

  it('carries the status of any other refusal for the console', async () => {
    answering(409, { message: 'Another event' });

    await expect(readJson('/api/x')).rejects.toMatchObject({
      name: 'PluginRequestError',
      status: 409,
    });
    await expect(readJson('/api/x')).rejects.toBeInstanceOf(PluginRequestError);
  });
});
