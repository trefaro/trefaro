import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import {
  ADMIN_SESSION_REPOSITORY,
  type AdminSessionRepository,
  type AuthenticatedAdmin,
} from './ports/admin-session.repository';

/** 256 bits of randomness — the token is the only thing standing in the door. */
const SESSION_TOKEN_BYTES = 32;

/**
 * How stale a session's last-seen stamp may get before a request refreshes it.
 * Without a threshold every admin request would write a row.
 */
const TOUCH_AFTER_MS = 5 * 60_000;

/** Expired rows are dead weight, not a risk — sweeping twice a day is plenty. */
const SWEEP_INTERVAL_MS = 12 * 60 * 60_000;

export interface IssuedSession {
  /** The value that travels in the cookie. Never stored, only its hash. */
  readonly token: string;
  readonly expiresAt: Date;
}

/** The stored form of a session token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues, resolves and revokes administrative sessions (F22, UC 01).
 *
 * The session is idle-expiring: every request slides the deadline forward, so
 * an organizer working through an afternoon stays logged in while an abandoned
 * browser does not.
 */
@Injectable()
export class SessionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SessionService.name);
  private sweep: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY)
    private readonly sessions: AdminSessionRepository,
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sweepExpired();
    this.sweep = setInterval(() => {
      void this.sweepExpired();
    }, SWEEP_INTERVAL_MS);
    // Must not keep the process alive when the container is asked to stop.
    this.sweep.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.sweep) clearInterval(this.sweep);
    this.sweep = null;
  }

  async issue(
    adminUserId: string,
    userAgent: string | null,
  ): Promise<IssuedSession> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    const expiresAt = this.expiryFrom(new Date());

    await this.sessions.create({
      adminUserId,
      tokenHash: hashSessionToken(token),
      userAgent,
      expiresAt,
    });

    return { token, expiresAt };
  }

  /** `null` for an unknown, expired or revoked token — the caller cannot tell which. */
  async resolve(token: string): Promise<AuthenticatedAdmin | null> {
    const now = new Date();
    const found = await this.sessions.findActive(hashSessionToken(token), now);
    if (!found) return null;

    if (now.getTime() - found.lastSeenAt.getTime() < TOUCH_AFTER_MS) {
      return found;
    }

    const expiresAt = this.expiryFrom(now);
    await this.sessions.touch(found.sessionId, now, expiresAt);
    // Report the deadline as it now stands, not as it was read.
    return { ...found, lastSeenAt: now, expiresAt };
  }

  /** Idempotent: logging out twice, or with a stale token, is not an error. */
  async revoke(token: string): Promise<void> {
    await this.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  private expiryFrom(now: Date): Date {
    return new Date(
      now.getTime() + this.env.adminAuth.sessionTtlHours * 60 * 60_000,
    );
  }

  private async sweepExpired(): Promise<void> {
    try {
      const removed = await this.sessions.deleteExpired(new Date());
      if (removed > 0) {
        this.logger.log(`Removed ${removed} expired administrative session(s)`);
      }
    } catch (error: unknown) {
      // Housekeeping must never take the server down.
      this.logger.warn(
        `Could not sweep expired sessions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
