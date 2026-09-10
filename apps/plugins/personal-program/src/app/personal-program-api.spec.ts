import { PersonalProgramApi } from './personal-program-api';
import { item } from './testing';

/**
 * The three addresses this plug-in speaks to.
 *
 * A component test would pass with a route that is spelled wrong, because the
 * fake is asked rather than the server — so the spelling itself is decided
 * here: one prefix for one audience (E57), the language as `?locale=` (F94),
 * and a write that carries no body because the address is the whole request.
 */
describe('PersonalProgramApi', () => {
  const realFetch = globalThis.fetch;
  let calls: { url: string; init?: RequestInit }[];

  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return init?.method && init.method !== 'GET'
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify([item()]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('reads one event’s plan under the participant prefix, with the language', async () => {
    await new PersonalProgramApi().plan('event-1', 'de-DE');

    expect(calls[0].url).toBe(
      '/api/participant/plugins/personal-program/events/event-1/plan?locale=de-DE',
    );
  });

  it('puts a session in the plan with PUT and no body', async () => {
    await new PersonalProgramApi().add('item-1');

    expect(calls[0].init?.method).toBe('PUT');
    expect(calls[0].init?.body).toBeUndefined();
    expect(calls[0].url).toBe(
      '/api/participant/plugins/personal-program/program-items/item-1',
    );
  });

  it('takes it out with DELETE on the same address', async () => {
    await new PersonalProgramApi().remove('item-1');

    expect(calls[0].init?.method).toBe('DELETE');
    expect(calls[0].url).toBe(
      '/api/participant/plugins/personal-program/program-items/item-1',
    );
  });
});
