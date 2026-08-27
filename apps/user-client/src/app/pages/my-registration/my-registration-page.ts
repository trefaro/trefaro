import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type {
  MyProgramItem,
  MyRegistration,
  ProgramDay,
} from '@trefaro/shared-models';
import {
  formatAnswer,
  formatEventPeriod,
  formatProgramTime,
  groupProgramByDay,
  hasEnded,
  isProgramItemFull,
  seatsLeft,
} from '@trefaro/shared-models';
import { SelfServiceService } from '../../features/self-service/self-service.service';

/**
 * "My registration" — the page the personal link in the receipt opens (E11).
 *
 * FR 3.10 is P1 and the participant login is P2, so this page is reached with a
 * signed token rather than a session. Three things follow from that, and all
 * three are visible in the markup:
 *
 * 1. **It shows only this registration.** No other participant, and no list of
 *    who signed up for what — the numbers are as far as it goes.
 * 2. **It says what the link is worth.** Whoever holds it can change this
 *    registration, and somebody forwarding the mail should know that.
 * 3. **A missing token is its own message.** A mail client that broke the link
 *    across two lines is the usual cause, and "invalid link" would send the
 *    reader looking for the wrong problem.
 *
 * Times are the venue's throughout (E8), grouped into days with the same helpers
 * the public timeline uses — one implementation of "which day is this session
 * on", not two.
 */
@Component({
  selector: 'trefaro-my-registration-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (!tokenValue()) {
      <h1>My registration</h1>
      <p class="notice" role="alert">
        This address is missing its token. Please open the whole link from your
        e-mail, including everything after the question mark.
      </p>
    } @else if (registration(); as mine) {
      <article>
        <header>
          <h1>My registration</h1>
          <p class="lead">
            {{ mine.firstName }} {{ mine.lastName }} ·
            <a
              [routerLink]="[
                '/series',
                mine.seriesSlug,
                'events',
                mine.event.slug,
              ]"
            >
              {{ mine.event.name }}
            </a>
          </p>
        </header>

        @if (error()) {
          <p class="notice" role="alert">{{ error() }}</p>
        }

        @if (mine.status === 'cancelled') {
          <p class="notice" role="status">
            This registration is cancelled. Register again from the event page
            if you would like to take part after all.
          </p>
        }

        <dl class="facts">
          <dt>Event</dt>
          <dd>{{ when(mine) }}</dd>

          <dt>E-mail</dt>
          <dd>{{ mine.email }}</dd>

          <dt>Registered</dt>
          <dd>{{ mine.status }}</dd>
        </dl>

        @if (answers(mine).length > 0) {
          <section aria-labelledby="answers-heading">
            <h2 id="answers-heading">What you entered</h2>
            <dl class="facts">
              @for (answer of answers(mine); track answer.key) {
                <dt>{{ answer.key }}</dt>
                <dd>{{ answer.value }}</dd>
              }
            </dl>
            <p class="meta">
              To change any of this, write to the organizer — this page does not
              rewrite your answers.
            </p>
          </section>
        }

        @if (days(mine).length > 0) {
          <section aria-labelledby="program-heading">
            <h2 id="program-heading">Programme</h2>
            <p class="meta">
              Sessions with a seat limit have to be claimed. The rest you simply
              come along to.
            </p>

            @for (day of days(mine); track day.key) {
              <h3 class="day">{{ day.label }}</h3>
              <ol class="sessions">
                @for (session of day.items; track session.id) {
                  <li class="session" [class.session--mine]="session.signedUp">
                    <p class="session__clock">{{ clock(mine, session) }}</p>
                    <div>
                      <h4 class="session__title">{{ session.title }}</h4>
                      @if (session.speaker) {
                        <p class="session__speaker">{{ session.speaker }}</p>
                      }
                      @if (session.registrationEnabled) {
                        <p class="session__seats">{{ seats(session) }}</p>
                        @if (session.signedUp) {
                          <button
                            type="button"
                            [disabled]="busy() || closed(mine)"
                            (click)="signOff(session)"
                          >
                            Give up my seat
                          </button>
                        } @else if (canSignUp(mine, session)) {
                          <button
                            type="button"
                            class="primary"
                            [disabled]="busy()"
                            (click)="signUp(session)"
                          >
                            Sign me up
                          </button>
                        }
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </section>
        }

        @if (mine.status !== 'cancelled') {
          <section aria-labelledby="cancel-heading">
            <h2 id="cancel-heading">Cannot come?</h2>
            <p class="meta">
              Cancelling frees your place, and the seats you claimed in
              individual sessions with it. Your registration stays on record so
              the organizer can see that you had signed up.
            </p>
            <button
              type="button"
              class="danger"
              [disabled]="busy()"
              (click)="cancel()"
            >
              Cancel my registration
            </button>
          </section>
        }

        <p class="meta">
          Keep the link to this page to yourself: whoever has it can change your
          registration.
        </p>
      </article>
    } @else if (error()) {
      <h1>My registration</h1>
      <p class="notice" role="alert">{{ error() }}</p>
      <p><a routerLink="/">Back to all event series</a></p>
    } @else {
      <p class="notice">Loading…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 40rem;
    }

    .lead {
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.35rem 0.9rem;
      margin-block: 1rem;
    }

    .facts dt {
      font-weight: 600;
    }

    .facts dd {
      margin: 0;
      white-space: pre-line;
    }

    .meta {
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .day {
      margin-block: 1.25rem 0.5rem;
      font-size: 1rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .sessions {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .session {
      display: grid;
      gap: 0.15rem 0.9rem;
      padding-inline-start: 0.75rem;
      border-inline-start: 2px solid
        color-mix(in oklab, var(--trefaro-color-accent) 60%, transparent);
    }

    .session--mine {
      border-inline-start-color: var(--trefaro-color-primary);
    }

    @media (min-width: 30rem) {
      .session {
        grid-template-columns: 7.5rem 1fr;
      }
    }

    .session__clock {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .session__title {
      margin: 0;
      font-size: 1rem;
    }

    .session__speaker,
    .session__seats {
      margin: 0.1rem 0 0;
      color: color-mix(in oklab, currentColor 75%, transparent);
      font-size: 0.9rem;
    }

    button {
      margin-block-start: 0.4rem;
      padding: 0.4rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button.primary {
      border: 0;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }

    button.danger {
      color: var(--trefaro-color-primary-strong);
    }

    button:disabled {
      opacity: 0.55;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class MyRegistrationPage {
  /**
   * From the link's query string, bound by `withComponentInputBinding()`.
   *
   * A query parameter that is not in the URL arrives as `undefined` and
   * overrides an `input()` default, so the default would look like a guarantee
   * it is not — hence {@link tokenValue}.
   */
  readonly token = input<string>();

  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly selfService = inject(SelfServiceService);
  private readonly config = inject(AppConfigService);

  protected readonly registration = signal<MyRegistration | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      void this.load(this.tokenValue());
    });
  }

  protected when(mine: MyRegistration): string {
    return formatEventPeriod(mine.event, this.locale());
  }

  /** The programme in the days the venue counts them (E8). */
  protected days(mine: MyRegistration): readonly ProgramDay<MyProgramItem>[] {
    return groupProgramByDay(mine.program, mine.event.timezone, this.locale());
  }

  protected clock(mine: MyRegistration, session: MyProgramItem): string {
    return formatProgramTime(session, mine.event.timezone, this.locale());
  }

  /** Their own answers, in the shape the participant overview shows them. */
  protected answers(
    mine: MyRegistration,
  ): readonly { key: string; value: string }[] {
    return Object.entries(mine.customFields).map(([key, value]) => ({
      key,
      value: formatAnswer(value),
    }));
  }

  /**
   * What this participant needs to know about one session's seats.
   *
   * Their own seat comes first, whether or not the session has a limit: the one
   * thing somebody opens this page to check is whether they are in. Only then the
   * numbers, and only where there is a limit to count against.
   */
  protected seats(session: MyProgramItem): string {
    const left = seatsLeft(session);
    if (session.signedUp) {
      return left === null
        ? 'Your seat is booked'
        : `Your seat is booked · ${session.signupCount} of ${session.capacity} taken`;
    }
    if (left === null) return `Sign-up · ${session.signupCount} so far`;
    return left === 0
      ? `Full · ${session.signupCount} of ${session.capacity} taken`
      : `${left} of ${session.capacity} seats free`;
  }

  /**
   * Whether the button to claim a seat is worth showing.
   *
   * The server decides for real — a seat can go while this page is open, which
   * is why every call answers with the whole view. What this spares the reader
   * is a button whose only possible outcome is a refusal.
   */
  protected canSignUp(mine: MyRegistration, session: MyProgramItem): boolean {
    return (
      !this.closed(mine) &&
      !isProgramItemFull(session) &&
      Date.parse(session.endsAt) > Date.now()
    );
  }

  /** A cancelled registration, or an event that is over: nothing left to claim. */
  protected closed(mine: MyRegistration): boolean {
    return mine.status === 'cancelled' || hasEnded(mine.event);
  }

  protected signUp(session: MyProgramItem): Promise<void> {
    return this.change(() =>
      this.selfService.signUp(session.id, this.tokenValue()),
    );
  }

  protected signOff(session: MyProgramItem): Promise<void> {
    return this.change(() =>
      this.selfService.signOff(session.id, this.tokenValue()),
    );
  }

  protected async cancel(): Promise<void> {
    if (
      !confirm(
        'Cancel your registration? Your seats in individual sessions go with it.',
      )
    ) {
      return;
    }
    await this.change(() => this.selfService.cancel(this.tokenValue()));
  }

  private locale(): string {
    return this.config.config()?.defaultLocale ?? 'en';
  }

  private async load(token: string): Promise<void> {
    if (!token) return;
    this.error.set(null);
    try {
      this.registration.set(await this.selfService.view(token));
    } catch (error: unknown) {
      this.registration.set(null);
      this.report(error, 'Your registration could not be loaded.');
    }
  }

  /**
   * Runs one change and replaces the view with what came back.
   *
   * The server answers with the whole registration, so nothing is patched in
   * place: the seat counts of every session are part of the answer, and another
   * participant may have taken one in the meantime.
   */
  private async change(action: () => Promise<MyRegistration>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.registration.set(await action());
    } catch (error: unknown) {
      this.report(error, 'That could not be saved. Please try again.');
      // The refusal is usually "somebody else took the last seat", so the page
      // is reloaded: showing the old numbers beside the message would invite the
      // same click again.
      await this.load(this.tokenValue());
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown, fallback: string): void {
    this.error.set((error as ApiError)?.message ?? fallback);
  }
}
