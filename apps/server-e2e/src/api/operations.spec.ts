import { api } from '../support/api-client';
import { adminCookie } from '../support/admin-session';

/**
 * What an operator can read about a running instance (NFR 10, NFR 11, AP 10).
 *
 * Two things are under test and they pull in opposite directions: the report
 * has to say enough for somebody to act on it, and it has to say nothing about
 * anybody. So the assertions below check the numbers **and** check that the one
 * field carrying a string — the mark of the last fault — carries a path with
 * its query values already gone.
 *
 * Costs no budget: reads only, and the session comes from the global setup
 * (E4).
 */
interface OperationsReport {
  startedAt: string;
  uptimeSeconds: number;
  database: { reachable: boolean; latencyMs: number | null };
  memory: { residentMb: number; heapUsedMb: number };
  requests: {
    succeeded: number;
    clientErrors: number;
    throttled: number;
    serverErrors: number;
  };
  lastIncident: {
    incident: string;
    at: string;
    status: number;
    path: string;
  } | null;
  mail: { sent: number; failed: number; lastFailureAt: string | null };
}

function report(cookie = adminCookie()) {
  return api<OperationsReport>('/api/admin/operations', {
    headers: { cookie },
  });
}

describe('GET /api/admin/operations', () => {
  it('is not for anybody who happens to ask', async () => {
    // The shape of an instance's traffic is not a thing to publish, and this
    // is the check that the administrative guard covers a controller that
    // lives in `core/` rather than in `business/` (E16).
    const { status } = await api('/api/admin/operations');

    expect(status).toBe(401);
  });

  it('says how long the server has been up and that the database answers', async () => {
    const { status, body } = await report();

    expect(status).toBe(200);
    expect(Date.parse(body.startedAt)).toBeGreaterThan(0);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.database.reachable).toBe(true);
    expect(body.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.memory.residentMb).toBeGreaterThan(1);
  });

  it('counts the answers it gives, this run included', async () => {
    const before = (await report()).body.requests.succeeded;
    await report();
    const after = (await report()).body.requests.succeeded;

    // Two requests between the two readings — this endpoint counts itself,
    // which is the plainest possible proof that the interceptor is mounted.
    expect(after).toBeGreaterThanOrEqual(before + 2);
  });

  it('counts a refusal apart from an answer that worked', async () => {
    const before = (await report()).body.requests;
    await api('/api/admin/events/11111111-1111-4111-8111-111111111111');
    const after = (await report()).body.requests;

    expect(after.clientErrors).toBeGreaterThan(before.clientErrors);
  });

  it('carries no query value into the one string it reports', async () => {
    // A fault is not provoked here — the contract suite has no route that
    // fails on purpose, and adding one would be a 500 in the shipped image.
    // What is asserted is the invariant: whatever mark is there, its path is
    // redacted. `all-exceptions.filter.spec.ts` proves the redaction itself.
    const { body } = await report();

    if (body.lastIncident !== null) {
      expect(body.lastIncident.incident).toMatch(/^[0-9a-f]{8}$/);
      expect(body.lastIncident.path).not.toMatch(/=(?!…)/);
    }
    expect(body.mail.sent).toBeGreaterThanOrEqual(0);
  });
});
