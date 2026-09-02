import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { hashSessionToken, newSessionToken } from '../common/session-token';
import {
  USER_SESSION_REPOSITORY,
  type AuthenticatedParticipant,
  type UserSessionRepository,
} from './ports/user-session.repository';

/**
 * How stale a session's last-seen stamp may get before a request refreshes it.
 * Without a threshold every participant request would write a row.
 */
const TOUCH_AFTER_MS = 5 * 60_000;

/** Expired rows are dead weight, not a risk — sweeping twice a day is plenty. */
const SWEEP_INTERVAL_MS = 12 * 60 * 60_000;

export interface IssuedUserSession {
  /** The value that travels in the cookie. Never stored, only its hash. */
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Issues, resolves and revokes participant sessions (FR 4.2, E34).
 *
 * The administrative session service's twin, and deliberately a separate class
 * rather than a shared one parameterized by table: the two write different
 * tables, read different cookies and answer different guards, and the whole
 * point of E34 is that neither can be mistaken for the other. What they share
 * is in `business/common/` — the token and its hash (F100).
 *
 * Idle-expiring the same way: every request slides the deadline forward, so
 * somebody reading a programme through an evening stays logged in while an
 * abandoned browser does not. The lifetime is `ADMIN_SESSION_TTL_HOURS`, the
 * one session lifetime this instance is configured with; a second variable
 * would be a switch nobody sets differently (E21).
 */
@Injectable()
export class UserSessionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(UserSessionService.name);
  private sweep: NodeJS.Timeout | null = null;

  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessions: UserSessionRepository,
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

  async issue(userId: string): Promise<IssuedUserSession> {
    const token = newSessionToken();
    const expiresAt = this.expiryFrom(new Date());

    await this.sessions.create({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    return { token, expiresAt };
  }

  /** `null` for an unknown, expired or revoked token — the caller cannot tell which. */
  async resolve(token: string): Promise<AuthenticatedParticipant | null> {
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

  /**
   * Ends every other session of one account (FR 4.3).
   *
   * Called after a password change, and that is the whole of its purpose:
   * somebody who changes their password because a device is not theirs any more
   * has said something about the other sessions too, and leaving them open
   * would make the change half a measure. The session doing the changing stays,
   * so the screen in front of the person does not log itself out.
   */
  async revokeOthers(userId: string, keepSessionId: string): Promise<void> {
    const ended = await this.sessions.deleteForUserExcept(
      userId,
      keepSessionId,
    );
    if (ended > 0) {
      // Counted for the operator, never shown: "you were logged out of two
      // other places" is a sentence about devices this server cannot describe.
      this.logger.log(
        `Ended ${ended} other participant session(s) after a password change`,
      );
    }
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
        this.logger.log(`Removed ${removed} expired participant session(s)`);
      }
    } catch (error: unknown) {
      // Housekeeping must never take the server down.
      this.logger.warn(
        `Could not sweep expired participant sessions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
