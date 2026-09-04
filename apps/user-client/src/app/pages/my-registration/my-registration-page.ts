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
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  AnswerWords,
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
  registrationStatusKey,
  seatsLeft,
} from '@trefaro/shared-models';
import {
  SelfServiceService,
  byLink,
  bySession,
  type SelfServiceAccess,
} from '../../features/self-service/self-service.service';

/**
 * "My registration" — one registration, reached in either of two ways (E11).
 *
 * The personal link in the receipt is the first, and it is why this page exists:
 * FR 3.10 is P1 and the participant login was P2. Since AP 4 of phase 3 the
 * same page also answers at `registrations/:id` for somebody who is logged in —
 * one screen, two credentials, because the view and the rules are identical and
 * a second page would be a second place to change them.
 *
 * Four things follow, and all four are visible in the markup:
 *
 * 1. **It shows only this registration.** No other participant, and no list of
 *    who signed up for what — the numbers are as far as it goes.
 * 2. **It says what the link is worth** — but only when a link is what got
 *    somebody here. Whoever holds it can change this registration, and somebody
 *    forwarding the mail should know that; somebody who signed in has nothing to
 *    keep to themselves.
 * 3. **A missing token is its own message.** A mail client that broke the link
 *    across two lines is the usual cause, and "invalid link" would send the
 *    reader looking for the wrong problem.
 * 4. **Cancelling works through either credential** since AP 12 (FR 4.7). The
 *    button asks for confirmation first, because it is the one action on this
 *    page that cannot be undone from here — registering again is a new
 *    registration.
 *
 * Times are the venue's throughout (E8), grouped into days with the same helpers
 * the public timeline uses — one implementation of "which day is this session
 * on", not two.
 */
@Component({
  selector: 'trefaro-my-registration-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (!access()) {
      <h1>{{ 'mine.title' | transloco }}</h1>
      <p class="notice" role="alert">{{ 'mine.noToken' | transloco }}</p>
    } @else if (registration(); as mine) {
      <article>
        <header>
          <h1>{{ 'mine.title' | transloco }}</h1>
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

        @if (error(); as problem) {
          <p class="notice" role="alert">
            {{ problem.key | transloco }}
            @if (problem.detail; as detail) {
              <span class="notice__detail">{{ detail }}</span>
            }
          </p>
        }

        @if (mine.status === 'cancelled') {
          <p class="notice" role="status">
            {{ 'mine.cancelled' | transloco }}
          </p>
        }

        <dl class="facts">
          <dt>{{ 'mine.event' | transloco }}</dt>
          <dd>{{ when(mine) }}</dd>

          <dt>{{ 'mine.email' | transloco }}</dt>
          <dd>{{ mine.email }}</dd>

          <dt>{{ 'mine.registered' | transloco }}</dt>
          <dd>{{ statusKey(mine) | transloco }}</dd>
        </dl>

        @if (answers(mine).length > 0) {
          <section aria-labelledby="answers-heading">
            <h2 id="answers-heading">{{ 'mine.answers' | transloco }}</h2>
            <dl class="facts">
              @for (answer of answers(mine); track answer.key) {
                <dt>{{ answer.key }}</dt>
                <dd>{{ answer.value }}</dd>
              }
            </dl>
            <p class="meta">{{ 'mine.answersHint' | transloco }}</p>
          </section>
        }

        @if (days(mine).length > 0) {
          <section aria-labelledby="program-heading">
            <h2 id="program-heading">{{ 'event.program' | transloco }}</h2>
            <p class="meta">{{ 'mine.programHint' | transloco }}</p>

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
                            {{ 'mine.giveUpSeat' | transloco }}
                          </button>
                        } @else if (canSignUp(mine, session)) {
                          <button
                            type="button"
                            class="primary"
                            [disabled]="busy()"
                            (click)="signUp(session)"
                          >
                            {{ 'mine.signMeUp' | transloco }}
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
            <h2 id="cancel-heading">{{ 'mine.cannotCome' | transloco }}</h2>
            <p class="meta">{{ 'mine.cancelHint' | transloco }}</p>
            <button
              type="button"
              class="danger"
              [disabled]="busy()"
              (click)="cancel()"
            >
              {{ 'mine.cancel' | transloco }}
            </button>
          </section>
        }

        @if (linkToken()) {
          <p class="meta">{{ 'mine.keepLink' | transloco }}</p>
        } @else {
          <p class="meta">
            <a routerLink="/registrations">{{
              'mine.list.back' | transloco
            }}</a>
          </p>
        }
      </article>
    } @else if (error(); as problem) {
      <h1>{{ 'mine.title' | transloco }}</h1>
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
      <p>
        <a routerLink="/">{{ 'event.backToSeriesList' | transloco }}</a>
      </p>
    } @else {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
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
   * it is not — hence {@link access}.
   */
  readonly token = input<string>();

  /** From the path, when a logged-in participant opened `registrations/:id`. */
  readonly id = input<string>();

  /**
   * Which credential this visit has, or `null` for neither.
   *
   * The token wins if both are somehow present: a link is what somebody is
   * holding in their hand, and it works whether or not they are also signed in.
   */
  protected readonly access = computed<SelfServiceAccess | null>(() => {
    const token = this.token();
    if (token) return byLink(token);
    const id = this.id();
    return id ? bySession(id) : null;
  });

  /** The token, when this visit came from a mail — for the two link-only parts. */
  protected readonly linkToken = computed(() => this.token() ?? '');

  private readonly selfService = inject(SelfServiceService);
  private readonly i18n = inject(TranslationService);

  protected readonly registration = signal<MyRegistration | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    // The language is read here so a switch re-runs the effect: the event's name
    // and the session titles are translated on the server (FR 3.12).
    effect(() => {
      void this.load(this.access(), this.i18n.locale());
    });
  }

  protected when(mine: MyRegistration): string {
    return formatEventPeriod(mine.event, this.i18n.locale());
  }

  /** The programme in the days the venue counts them (E8). */
  protected days(mine: MyRegistration): readonly ProgramDay<MyProgramItem>[] {
    return groupProgramByDay(
      mine.program,
      mine.event.timezone,
      this.i18n.locale(),
    );
  }

  protected clock(mine: MyRegistration, session: MyProgramItem): string {
    return formatProgramTime(session, mine.event.timezone, this.i18n.locale());
  }

  /** The state of this registration, as a key rather than a database word. */
  protected statusKey(mine: MyRegistration): string {
    return registrationStatusKey(mine.status);
  }

  /**
   * Their own answers, in the shape the participant overview shows them — and
   * in their own language.
   *
   * The two words for a tick are handed to `formatAnswer` (AP 13 of phase 3):
   * it used to answer in English, and this page printed that, in a client whose
   * every other sentence is translated (NFR 4).
   */
  protected answers(
    mine: MyRegistration,
  ): readonly { key: string; value: string }[] {
    // The locale is read here, not only inside `translate` — which does not
    // track it — so that a language switch redraws these words too (F72).
    this.i18n.locale();
    const words: AnswerWords = {
      yes: this.i18n.translate('common.yes'),
      no: this.i18n.translate('common.no'),
    };
    return Object.entries(mine.customFields).map(([key, value]) => ({
      key,
      value: formatAnswer(value, words),
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
        ? this.i18n.translate('mine.seats.booked')
        : this.i18n.translate('mine.seats.bookedOf', {
            count: session.signupCount,
            capacity: session.capacity,
          });
    }
    if (left === null) {
      return this.i18n.translate('event.seats.open', {
        count: session.signupCount,
      });
    }
    return left === 0
      ? this.i18n.translate('mine.seats.full', {
          count: session.signupCount,
          capacity: session.capacity,
        })
      : this.i18n.translate('event.seats.free', {
          left,
          capacity: session.capacity,
        });
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
    return this.withAccess((access) =>
      this.selfService.signUp(session.id, access, this.i18n.locale()),
    );
  }

  protected signOff(session: MyProgramItem): Promise<void> {
    return this.withAccess((access) =>
      this.selfService.signOff(session.id, access, this.i18n.locale()),
    );
  }

  protected async cancel(): Promise<void> {
    if (!confirm(this.i18n.translate('mine.confirmCancel'))) {
      return;
    }
    // Every one of these answers with the whole page, so every one carries the
    // language: without it, claiming a seat would switch the page to English.
    await this.withAccess((access) =>
      this.selfService.cancel(access, this.i18n.locale()),
    );
  }

  private async load(
    access: SelfServiceAccess | null,
    locale: string,
  ): Promise<void> {
    if (!access) return;
    this.error.set(null);
    try {
      this.registration.set(await this.selfService.view(access, locale));
    } catch (error: unknown) {
      this.registration.set(null);
      this.report(error, 'mine.error.load');
    }
  }

  /** Runs one change with whichever credential this visit has. */
  private withAccess(
    action: (access: SelfServiceAccess) => Promise<MyRegistration>,
  ): Promise<void> {
    const access = this.access();
    return access ? this.change(() => action(access)) : Promise.resolve();
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
      this.report(error, 'mine.error.save');
      // The refusal is usually "somebody else took the last seat", so the page
      // is reloaded: showing the old numbers beside the message would invite the
      // same click again.
      await this.load(this.access(), this.i18n.locale());
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * What went wrong, in the reader's language, with the server's reason beside
   * it (F77).
   *
   * The reason is the point here: "somebody else took the last seat" is why the
   * page is showing different numbers than a moment ago, and no key of this
   * client can say that.
   */
  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}
