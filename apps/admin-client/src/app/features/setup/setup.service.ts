import { Injectable, computed, inject, signal } from '@angular/core';
import { STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import {
  SETUP_TOKEN_HEADER,
  type SetupResult,
  type SetupState,
  type SetupSubmission,
} from '@trefaro/shared-models';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * Whether this instance still has to be claimed, and the wizard's two calls
 * (FR 1.1, AP 5 of phase 2).
 *
 * The availability question is answered by a status code, not by a payload: the
 * server hands out the setup state only against the token, and says **401**
 * while the instance is unclaimed and **404** once it has an administrator
 * (E28). So a request without a token is a complete answer to "which screen
 * belongs here", and the body stays protected.
 *
 * The token is held in memory for the life of the page and nowhere else. Not in
 * `localStorage`: it is a one-off secret out of a server log, it is worthless
 * ten minutes later, and a copy of it surviving in a browser profile is a copy
 * nobody remembers to remove.
 */
@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly api = inject(ApiClient);
  private readonly startupTimeoutMs = inject(STARTUP_TIMEOUT_MS);

  private readonly pending = signal(false);
  private readonly unlocked = signal<SetupState | null>(null);
  private token: string | null = null;

  /** Whether the setup route exists — i.e. nobody can log in to this instance. */
  readonly isPending = this.pending.asReadonly();

  /** The state, once a token has been accepted. */
  readonly state = this.unlocked.asReadonly();

  readonly isUnlocked = computed(() => this.unlocked() !== null);

  /**
   * Startup: does this instance have an administrator?
   *
   * Runs without a token on purpose, so the answer costs one request and reveals
   * nothing. Anything other than a 401 — a 404, an unreachable server, a proxy
   * returning HTML — is read as "set up", because the login form is the safe
   * screen to show: a wizard offered on an instance that has administrators
   * would be a puzzle, while a login form on a fresh instance is at worst an
   * extra click after the operator reads the log.
   */
  async probe(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.api
          .get<SetupState>('setup/state')
          .pipe(timeout(this.startupTimeoutMs)),
      );
      // A 200 without a token cannot happen; if it ever did, the instance is
      // unclaimed and the wizard is the right screen.
      this.pending.set(true);
    } catch (error: unknown) {
      this.pending.set((error as { status?: number })?.status === 401);
    }
    return this.pending();
  }

  /**
   * Exchanges the token from the log for the state the form fills itself with.
   *
   * @throws ApiError — 401 for a wrong token, 404 once somebody else has claimed
   * the instance in the meantime.
   */
  async unlock(token: string): Promise<SetupState> {
    const state = await firstValueFrom(
      this.api.get<SetupState>('setup/state', undefined, this.headers(token)),
    );
    this.token = token;
    this.unlocked.set(state);
    this.pending.set(true);
    return state;
  }

  /** @throws ApiError — 400 for a refused value, 404 once it is too late. */
  async complete(submission: SetupSubmission): Promise<SetupResult> {
    if (this.token === null) {
      throw new Error('The setup token has not been accepted yet');
    }

    const result = await firstValueFrom(
      this.api.post<SetupResult>(
        'setup/admin',
        submission,
        this.headers(this.token),
      ),
    );

    // From here the route answers 404 for everybody, this page included.
    this.token = null;
    this.unlocked.set(null);
    this.pending.set(false);
    return result;
  }

  private headers(token: string): Record<string, string> {
    return { [SETUP_TOKEN_HEADER]: token };
  }
}
