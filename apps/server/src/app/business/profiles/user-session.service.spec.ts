import type { TrefaroEnv } from '../../core/config/env';
import { hashSessionToken } from '../common/session-token';
import type {
  AuthenticatedParticipant,
  NewUserSession,
  UserSessionRepository,
} from './ports/user-session.repository';
import type { UserProfileRecord } from './ports/user-profile.repository';
import { UserSessionService } from './user-session.service';

const owner: UserProfileRecord = {
  id: 'profile-1',
  email: 'amina@example.org',
  passwordHash: 'hashed:secret',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'de',
  avatarPath: null,
  activityAreas: null,
  customFields: {},
  searchable: false,
  confirmedAt: new Date('2026-09-01T10:00:00Z'),
  createdAt: new Date('2026-09-01T09:00:00Z'),
  updatedAt: new Date('2026-09-01T10:00:00Z'),
};

/** The fake's own row — mutable, so a test can age it or expire it. */
type StoredSession = {
  -readonly [K in keyof NewUserSession]: NewUserSession[K];
} & { id: string; lastSeenAt: Date };

class FakeUserSessionRepository implements UserSessionRepository {
  stored: StoredSession | null = null;
  readonly touched: { sessionId: string; seenAt: Date; expiresAt: Date }[] = [];
  readonly revokedHashes: string[] = [];
  readonly revokedOthers: { userId: string; keepSessionId: string }[] = [];
  readonly sweptAt: Date[] = [];

  async create(session: NewUserSession): Promise<void> {
    this.stored = { ...session, id: 'session-1', lastSeenAt: new Date() };
  }

  async findActive(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedParticipant | null> {
    if (!this.stored) return null;
    if (this.stored.tokenHash !== tokenHash) return null;
    if (this.stored.expiresAt.getTime() <= now.getTime()) return null;

    return {
      sessionId: this.stored.id,
      profile: owner,
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

  async deleteForUserExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<number> {
    this.revokedOthers.push({ userId, keepSessionId });
    return 2;
  }

  async deleteExpired(now: Date): Promise<number> {
    this.sweptAt.push(now);
    return 0;
  }
}

describe('UserSessionService', () => {
  const env = { adminAuth: { sessionTtlHours: 12 } } as TrefaroEnv;
  let sessions: FakeUserSessionRepository;
  let service: UserSessionService;

  beforeEach(() => {
    sessions = new FakeUserSessionRepository();
    service = new UserSessionService(sessions, env);
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  it('stores only the hash of the token it hands out', async () => {
    const issued = await service.issue(owner.id);

    expect(issued.token).toHaveLength(43); // 32 random bytes, base64url
    expect(sessions.stored?.tokenHash).toBe(hashSessionToken(issued.token));
    // The token itself must appear nowhere in the row.
    expect(JSON.stringify(sessions.stored)).not.toContain(issued.token);
  });

  it('issues a token nobody can guess from another one', async () => {
    const first = await service.issue(owner.id);
    const second = await service.issue(owner.id);

    expect(first.token).not.toBe(second.token);
  });

  it('resolves a live session to its owner', async () => {
    const issued = await service.issue(owner.id);

    await expect(service.resolve(issued.token)).resolves.toMatchObject({
      profile: owner,
    });
  });

  it('refuses an unknown token without saying why', async () => {
    await service.issue(owner.id);

    await expect(service.resolve('not-a-token')).resolves.toBeNull();
  });

  it('refuses a token whose session has expired', async () => {
    const issued = await service.issue(owner.id);
    // Reach into the fake rather than wait twelve hours.
    sessions.stored!.expiresAt = new Date(Date.now() - 1_000);

    await expect(service.resolve(issued.token)).resolves.toBeNull();
  });

  it('does not write a row for every request', async () => {
    const issued = await service.issue(owner.id);

    await service.resolve(issued.token);
    await service.resolve(issued.token);

    expect(sessions.touched).toHaveLength(0);
  });

  it('slides the deadline forward once the stamp is stale', async () => {
    const issued = await service.issue(owner.id);
    sessions.stored!.lastSeenAt = new Date(Date.now() - 10 * 60_000);

    const resolved = await service.resolve(issued.token);

    expect(sessions.touched).toHaveLength(1);
    // And reports the deadline as it now stands, not as it was read.
    expect(resolved?.expiresAt).toEqual(sessions.touched[0].expiresAt);
  });

  it('revokes by hash, and twice is not an error', async () => {
    const issued = await service.issue(owner.id);

    await service.revoke(issued.token);
    await service.revoke(issued.token);

    expect(sessions.revokedHashes).toEqual([
      hashSessionToken(issued.token),
      hashSessionToken(issued.token),
    ]);
    await expect(service.resolve(issued.token)).resolves.toBeNull();
  });

  it('sweeps expired rows on boot', async () => {
    await service.onApplicationBootstrap();

    expect(sessions.sweptAt).toHaveLength(1);
  });

  it('survives a sweep that fails — housekeeping must not take the server down', async () => {
    sessions.deleteExpired = () => Promise.reject(new Error('database gone'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
