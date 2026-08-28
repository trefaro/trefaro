import { Injectable, computed, inject, signal } from '@angular/core';
import { STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import type { AdminAccount, AdminSessionInfo } from '@trefaro/shared-models';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * Paths whose 401 is an answer rather than an expired session.
 *
 * The first two are the login and the session probe. The third is the first-run
 * setup, where a 401 means "this instance is unclaimed and the token was missing
 * or wrong" (E28) — sending that to the login form would send the operator to a
 * form no account can pass yet.
 */
export const AUTH_PROBE_PATHS = [
  'admin/auth/me',
  'admin/auth/login',
  'setup/',
] as const;

/**
 * Who is logged in to the organizer client (UC 01).
 *
 * The session itself lives in an HttpOnly cookie, which this client can neither
 * read nor forge — so "am I logged in?" is a question only the server can
 * answer. {@link restore} asks it once at startup; everything else reads the
 * signal.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly startupTimeoutMs = inject(STARTUP_TIMEOUT_MS);
  private readonly session = signal<AdminSessionInfo | null>(null);

  readonly admin = computed<AdminAccount | null>(
    () => this.session()?.admin ?? null,
  );

  readonly isLoggedIn = computed(() => this.session() !== null);

  /** When the session lapses if it is left alone, or `null` when logged out. */
  readonly expiresAt = computed(() => {
    const value = this.session()?.expiresAt;
    return value ? new Date(value) : null;
  });

  /**
   * Startup: turn the cookie the browser may already have into a session.
   *
   * A 401 is the normal answer for a visitor who has not logged in, so it
   * resolves to `false` instead of failing startup.
   */
  async restore(): Promise<boolean> {
    try {
      this.session.set(
        await firstValueFrom(
          // Bounded like the configuration fetch: a server that accepts the
          // connection and then never answers must not leave the organizer
          // looking at a blank page instead of the login form.
          this.api
            .get<AdminSessionInfo>('admin/auth/me')
            .pipe(timeout(this.startupTimeoutMs)),
        ),
      );
      return true;
    } catch {
      this.session.set(null);
      return false;
    }
  }

  /** @throws ApiError — 401 for wrong credentials, 429 once throttled. */
  async login(email: string, password: string): Promise<void> {
    this.session.set(
      await firstValueFrom(
        this.api.post<AdminSessionInfo>('admin/auth/login', {
          email,
          password,
        }),
      ),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post<void>('admin/auth/logout', {}));
    } finally {
      // Whatever the server said, this browser is done with the session.
      this.session.set(null);
    }
  }

  /** Called by the interceptor when the server stops accepting the cookie. */
  clear(): void {
    this.session.set(null);
  }
}

/**
 * Whether a 401 from this URL means "your session is gone".
 *
 * On the login and the session probe a 401 is the answer to the question that
 * was asked, and must not be read as an expiry.
 */
export function isSessionProbe(url: string): boolean {
  return AUTH_PROBE_PATHS.some((path) => url.includes(path));
}
