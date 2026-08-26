import type { TrefaroEnv } from '../../core/config/env';
import type {
  AdminSessionRepository,
  AuthenticatedAdmin,
  NewAdminSession,
} from './ports/admin-session.repository';
import type { AdminUserRecord } from './ports/admin-user.repository';
import { SessionService, hashSessionToken } from './session.service';

const owner: AdminUserRecord = {
  id: 'admin-1',
  email: 'organizer@example.org',
  name: 'Alex Weber',
  passwordHash: 'hashed:secret',
  createdAt: new Date('2026-08-01T10:00:00Z'),
  lastLoginAt: null,
};

/** The fake's own row — mutable, so a test can age it or expire it. */
type StoredSession = {
  -readonly [K in keyof NewAdminSession]: NewAdminSession[K];
} & { id: string; lastSeenAt: Date };

class FakeSessionRepository implements AdminSessionRepository {
  stored: StoredSession | null = null;
  readonly touched: { sessionId: string; seenAt: Date; expiresAt: Date }[] = [];
  readonly revokedHashes: string[] = [];
  readonly sweptAt: Date[] = [];

  async create(session: NewAdminSession): Promise<void> {
    this.stored = { ...session, id: 'session-1', lastSeenAt: new Date() };
  }

  async findActive(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedAdmin | null> {
    if (!this.stored) return null;
    if (this.stored.tokenHash !== tokenHash) return null;
    if (this.stored.expiresAt.getTime() <= now.getTime()) return null;

    return {
      sessionId: this.stored.id,
      admin: owner,
      lastSeenAt: this.stored.lastSeenAt,
      expiresAt: this.stored.expiresAt,
    };
  }

  async touch(sessionId: string, seenAt: Date, expiresAt: Date): Promise<void> {
    this.touched.push({ sessionId, seenAt, expiresAt });
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.revokedHashes.push(tokenHash);
    if (this.stored?.tokenHash === tokenHash) this.stored = null;
  }

  async deleteExpired(now: Date): Promise<number> {
    this.sweptAt.push(now);
    return 0;
  }
}

describe('SessionService', () => {
  const env = { adminAuth: { sessionTtlHours: 12 } } as TrefaroEnv;
  let sessions: FakeSessionRepository;
  let service: SessionService;

  beforeEach(() => {
    sessions = new FakeSessionRepository();
    service = new SessionService(sessions, env);
  });

  it('stores only the hash of the token it hands out', async () => {
    const issued = await service.issue('admin-1', 'Firefox');

    expect(issued.token).toHaveLength(43); // 32 random bytes, base64url
    expect(sessions.stored?.tokenHash).toBe(hashSessionToken(issued.token));
    expect(sessions.stored?.tokenHash).not.toContain(issued.token);
  });

  it('applies the configured idle lifetime', async () => {
    const before = Date.now();
    const issued = await service.issue('admin-1', null);

    const lifetimeMs = issued.expiresAt.getTime() - before;
    expect(lifetimeMs).toBeGreaterThan(11.9 * 60 * 60_000);
    expect(lifetimeMs).toBeLessThan(12.1 * 60 * 60_000);
  });

  it('resolves a fresh token to its owner', async () => {
    const issued = await service.issue('admin-1', null);

    await expect(service.resolve(issued.token)).resolves.toMatchObject({
      sessionId: 'session-1',
      admin: { id: 'admin-1' },
    });
  });

  it('does not resolve an unknown token', async () => {
    await service.issue('admin-1', null);

    await expect(service.resolve('not-a-session')).resolves.toBeNull();
  });

  it('does not resolve a session past its deadline', async () => {
    const issued = await service.issue('admin-1', null);
    // The repository decides what "active" means; here the deadline has passed.
    (sessions.stored as StoredSession).expiresAt = new Date(Date.now() - 1_000);

    await expect(service.resolve(issued.token)).resolves.toBeNull();
  });

  it('leaves a session it has just seen alone', async () => {
    const issued = await service.issue('admin-1', null);

    await service.resolve(issued.token);

    // A write per request would cost more than the sliding deadline is worth.
    expect(sessions.touched).toHaveLength(0);
  });

  it('slides the deadline of a session that has been idle, and reports the new one', async () => {
    const issued = await service.issue('admin-1', null);
    const stored = sessions.stored as StoredSession;
    // An organizer who left the tab open for a while: last seen ten minutes
    // ago, and the deadline they were given is close.
    stored.lastSeenAt = new Date(Date.now() - 10 * 60_000);
    stored.expiresAt = new Date(Date.now() + 60 * 60_000);

    const resolved = await service.resolve(issued.token);

    expect(sessions.touched).toHaveLength(1);
    // The deadline is recomputed from now, and reported as it now stands.
    expect(resolved?.expiresAt).toEqual(sessions.touched[0].expiresAt);
    expect(resolved?.expiresAt.getTime()).toBeGreaterThan(
      stored.expiresAt.getTime(),
    );
    expect(resolved?.lastSeenAt.getTime()).toBeGreaterThan(
      stored.lastSeenAt.getTime(),
    );
  });

  it('stops a token from working once it is revoked', async () => {
    const issued = await service.issue('admin-1', null);

    await service.revoke(issued.token);

    expect(sessions.revokedHashes).toEqual([hashSessionToken(issued.token)]);
    await expect(service.resolve(issued.token)).resolves.toBeNull();
  });

  it('sweeps expired sessions on startup and stops the timer on shutdown', async () => {
    await service.onApplicationBootstrap();

    expect(sessions.sweptAt).toHaveLength(1);

    service.onApplicationShutdown();
  });

  it('survives a failing sweep instead of taking the server down', async () => {
    sessions.deleteExpired = () => Promise.reject(new Error('database gone'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    service.onApplicationShutdown();
  });
});
