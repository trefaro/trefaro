import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService, STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import {
  PROFILES_MODULE_KEY,
  type ParticipantAccount,
  type ParticipantSessionInfo,
  type ProfileConfirmation,
  type ProfileRegistrationAcknowledgement,
  type ProfileRegistrationRequest,
} from '@trefaro/shared-models';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * Paths whose 401 is an answer rather than an expired session.
 *
 * On the startup probe and the login form a 401 means "you are not logged in",
 * which is what was asked. The password change is the third and the least
 * obvious: its 401 is "the current password is not right" — the server cannot
 * spell that differently, and reading it as an expiry would log somebody out
 * and blame their session for a typo.
 *
 * Everything else below `participant/` answering 401 means a session that used
 * to work has stopped working, and the person deserves to be told rather than
 * shown a broken screen. `participant/me/avatar` is deliberately *not* here for
 * exactly that reason.
 */
export const PARTICIPANT_PROBE_PATHS = [
  'participant/me',
  'participant/me/password',
  'participant/auth/login',
] as const;

/**
 * Where this browser remembers that it once had a session.
 *
 * Not the session and not a credential — the token stays in the HttpOnly cookie
 * this client cannot read (E34). Only a hint that asking is worth a request:
 * most visitors of this client never log in, and probing for all of them meant
 * a 401 in the console of every public page load and a request nobody needed.
 *
 * Being wrong is cheap in both directions. A hint without a cookie costs one
 * 401 and clears itself; a cookie without a hint means somebody has to log in
 * again after clearing their browser storage, which is what clearing browser
 * storage is for.
 */
const SESSION_HINT_KEY = 'trefaro.participant-session';

/**
 * Who is logged in to the participant client (FR 4.1, FR 4.2, UC 09).
 *
 * The session lives in an HttpOnly cookie of its own (`trefaro_user_session`,
 * E34), which this client can neither read nor forge — so "am I logged in?" is
 * a question only the server can answer. {@link restore} asks it once at
 * startup; every screen reads the signal.
 *
 * The organizer client's `AuthService` is the twin, and the two are deliberately
 * not one shared class: they read different cookies, call different endpoints
 * and answer different guards, and the point of E34 is that neither can be
 * mistaken for the other.
 *
 * Creating and confirming an account live here too, although they are the only
 * two calls that go to `/api/user` rather than `/api/participant` (E33): at
 * that point there is nobody to authenticate. They are about the same thing —
 * this browser's account — and splitting them off would put half of one
 * subject in a second file.
 */
@Injectable({ providedIn: 'root' })
export class ParticipantSessionService {
  private readonly api = inject(ApiClient);
  private readonly config = inject(AppConfigService);
  private readonly startupTimeoutMs = inject(STARTUP_TIMEOUT_MS);
  private readonly document = inject(DOCUMENT);
  private readonly session = signal<ParticipantSessionInfo | null>(null);

  readonly participant = computed<ParticipantAccount | null>(
    () => this.session()?.participant ?? null,
  );

  readonly isLoggedIn = computed(() => this.session() !== null);

  /** When the session lapses if it is left alone, or `null` when logged out. */
  readonly expiresAt = computed(() => {
    const value = this.session()?.expiresAt;
    return value ? new Date(value) : null;
  });

  /**
   * Whether this instance keeps participant accounts at all (F53).
   *
   * An organization that only runs events can switch the `profiles` module off,
   * and then every route below it answers 404. The client has to agree with
   * that, or it offers a login form that cannot work — which is why the switch
   * is read from the configuration both sides already share.
   */
  readonly accountsEnabled = computed(() =>
    this.config.isModuleEnabled(PROFILES_MODULE_KEY),
  );

  /**
   * Startup: turn the cookie this browser may already have into a session.
   *
   * Nothing is asked at all in two cases: while accounts are switched off
   * (F53), and while this browser has never logged in — see
   * {@link SESSION_HINT_KEY}. Otherwise a 401 is a perfectly normal answer and
   * resolves to `false` rather than failing startup.
   */
  async restore(): Promise<boolean> {
    if (!this.accountsEnabled() || !this.hinted()) {
      this.session.set(null);
      return false;
    }

    try {
      this.session.set(
        await firstValueFrom(
          // Bounded like the configuration fetch: a server that accepts the
          // connection and then never answers must not leave somebody looking
          // at a blank page instead of an event.
          this.api
            .get<ParticipantSessionInfo>('participant/me')
            .pipe(timeout(this.startupTimeoutMs)),
        ),
      );
      this.remember(true);
      return true;
    } catch {
      this.session.set(null);
      // The cookie is gone or was never there; stop asking on every visit.
      this.remember(false);
      return false;
    }
  }

  /**
   * Creates an account, or says nothing about whether it did (E32).
   *
   * The answer carries the address back and nothing else, whatever the state of
   * that address was — the page has to say "a mail is on its way" and mean it
   * either way.
   *
   * @throws ApiError — 400 for an incomplete form, 503 when no mail could go out.
   */
  register(
    request: ProfileRegistrationRequest,
  ): Promise<ProfileRegistrationAcknowledgement> {
    return firstValueFrom(
      this.api.post<ProfileRegistrationAcknowledgement>(
        'user/profiles',
        request,
      ),
    );
  }

  /** @throws ApiError — 400 for a forged or expired token, 404 if the account is gone. */
  confirm(token: string): Promise<ProfileConfirmation> {
    return firstValueFrom(
      this.api.post<ProfileConfirmation>('user/profiles/confirm', { token }),
    );
  }

  /** @throws ApiError — 401 for wrong credentials, 403 unconfirmed, 429 throttled. */
  async logIn(email: string, password: string): Promise<void> {
    this.session.set(
      await firstValueFrom(
        this.api.post<ParticipantSessionInfo>('participant/auth/login', {
          email,
          password,
        }),
      ),
    );
    this.remember(true);
  }

  async logOut(): Promise<void> {
    try {
      await firstValueFrom(this.api.post<void>('participant/auth/logout', {}));
    } finally {
      // Whatever the server said, this browser is done with the session.
      this.session.set(null);
      this.remember(false);
    }
  }

  /**
   * Takes the account as the profile form just saved it.
   *
   * So the header greets the new name straight away instead of the one that was
   * read at startup. The session's deadline is untouched: saving a profile is
   * not what extends a session, the request that carried it already did.
   */
  adopt(participant: ParticipantAccount): void {
    this.session.update((session) =>
      session ? { ...session, participant } : session,
    );
  }

  /** Called by the interceptor when the server stops accepting the cookie. */
  clear(): void {
    this.session.set(null);
    this.remember(false);
  }

  private hinted(): boolean {
    try {
      return (
        this.document.defaultView?.localStorage.getItem(SESSION_HINT_KEY) ===
        'yes'
      );
    } catch {
      // Storage denied: ask, and let the 401 be the answer. A participant who
      // browses in a private window still gets a working profile.
      return true;
    }
  }

  private remember(hasSession: boolean): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (hasSession) storage?.setItem(SESSION_HINT_KEY, 'yes');
      else storage?.removeItem(SESSION_HINT_KEY);
    } catch {
      /* see `hinted()` */
    }
  }
}

/**
 * Whether a 401 from this URL means "your session is gone".
 *
 * Matched on the end of the path rather than with `includes`: `participant/me`
 * is a prefix of `participant/me/avatar`, and a substring test would have
 * exempted a route nobody meant to exempt. The query string is cut off first,
 * because a probe stays a probe with parameters on it.
 */
export function isParticipantProbe(url: string): boolean {
  const path = url.split('?')[0];
  return PARTICIPANT_PROBE_PATHS.some((probe) => path.endsWith(probe));
}
