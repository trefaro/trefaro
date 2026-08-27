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
  ProgramDay,
  PublicEvent,
  PublicProgramItem,
} from '@trefaro/shared-models';
import {
  formatEventPeriod,
  formatProgramTime,
  groupProgramByDay,
  hasEnded,
} from '@trefaro/shared-models';
import { PluginSlot } from '@trefaro/shared-plugins';
import { PublicEventsService } from '../../features/events/public-events.service';
import { PublicProgramService } from '../../features/program/public-program.service';

/**
 * The public event landing page (FR 3.6) — the highest-rated participant
 * feature of the survey (3,74).
 *
 * Reachable without a login and without a registration: this is the page a
 * shared link points at, and someone who has never heard of the organization
 * has to be able to judge from it whether to come. Hence the order: what it is,
 * when, where, in which language, and only then the call to action.
 *
 * Times are rendered in the event's own zone, never the reader's (E8), and the
 * zone is named — a participant three time zones away must not have to guess
 * whose 09:00 this is. That holds for the programme below as much as for the
 * event itself: the timeline groups sessions into the days they fall on *at the
 * venue*, and each day heading names the zone once.
 *
 * The programme is fetched separately from the event (FR 3.7). What the page
 * has to answer first is "what is this, when, where" — a conference with two
 * hundred sessions must not delay that.
 *
 * Carries the second plug-in hook point: the programme, the room plan and the
 * forum mount here as web components once their modules are enabled.
 */
@Component({
  selector: 'trefaro-event-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PluginSlot],
  template: `
    @if (error()) {
      <p class="notice" role="alert">{{ error() }}</p>
      <p><a routerLink="/">Back to all event series</a></p>
    } @else if (event(); as item) {
      <article>
        <header class="head">
          @if (item.logoUrl) {
            <img class="head__logo" [src]="item.logoUrl" alt="" />
          }
          <div>
            <h1>{{ item.name }}</h1>
            @if (isOver()) {
              <p class="over">This event has ended.</p>
            }
          </div>
        </header>

        <dl class="facts">
          <dt>When</dt>
          <dd>{{ when() }}</dd>

          <dt>Format</dt>
          <dd>{{ format() }}</dd>

          @if (item.venueName) {
            <dt>Where</dt>
            <dd>
              {{ item.venueName }}
              @if (item.venueAddress) {
                <span class="address">{{ item.venueAddress }}</span>
              }
            </dd>
          }
          @if (item.onlineUrl) {
            <dt>Online</dt>
            <dd>
              <a [href]="item.onlineUrl" rel="noopener noreferrer">
                {{ item.onlineUrl }}
              </a>
            </dd>
          }

          <dt>{{ item.languages.length === 1 ? 'Language' : 'Languages' }}</dt>
          <dd>{{ item.languages.join(', ') }}</dd>
        </dl>

        <p class="description">{{ item.description }}</p>

        @if (days().length > 0) {
          <section class="program" aria-labelledby="program-heading">
            <h2 id="program-heading">Programme</h2>
            @for (day of days(); track day.key) {
              <h3 class="program__day">{{ day.label }}</h3>
              <ol class="program__items">
                <!-- Named session, not item: the event is already bound to
                     item above, and shadowing it here would be a trap. -->
                @for (session of day.items; track session.id) {
                  <li class="session">
                    <p class="session__clock">{{ clock(session) }}</p>
                    <div>
                      <h4 class="session__title">{{ session.title }}</h4>
                      @if (session.speaker) {
                        <p class="session__speaker">{{ session.speaker }}</p>
                      }
                      @if (session.description) {
                        <p class="session__text">{{ session.description }}</p>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </section>
        }

        @if (!isOver()) {
          <p class="cta">
            <a
              class="cta__button"
              [routerLink]="[
                '/series',
                seriesSlug(),
                'events',
                eventSlug(),
                'register',
              ]"
            >
              Register now
            </a>
            <small>You will be asked to confirm your e-mail address.</small>
          </p>
        }

        <!-- Plug-in hook point two: the event detail view. Each plug-in gets the
             event as element properties. -->
        <trefaro-plugin-slot
          mountPoint="event-detail"
          [context]="pluginContext()"
        />

        <p>
          <a [routerLink]="['/series', seriesSlug()]">
            All events of this series
          </a>
        </p>
      </article>
    } @else {
      <p class="notice">Loading…</p>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .head__logo {
      inline-size: 3.5rem;
      block-size: 3.5rem;
      object-fit: contain;
    }

    .over {
      margin: 0;
      color: color-mix(in oklab, currentColor 65%, transparent);
    }

    .facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.35rem 0.9rem;
      max-inline-size: 40rem;
      margin-block: 1.25rem;
    }

    .facts dt {
      font-weight: 600;
    }

    .facts dd {
      margin: 0;
    }

    .address {
      display: block;
      white-space: pre-line;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .description {
      max-inline-size: 40rem;
      white-space: pre-line;
    }

    .program {
      max-inline-size: 40rem;
      margin-block: 1.75rem;
    }

    .program__day {
      margin-block: 1.25rem 0.5rem;
      font-size: 1rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .program__items {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* Mobile-first: the clock sits above the session and moves beside it as
       soon as there is room for a column of times. */
    .session {
      display: grid;
      gap: 0.15rem 0.9rem;
      padding-inline-start: 0.75rem;
      border-inline-start: 2px solid
        color-mix(in oklab, var(--trefaro-color-accent) 60%, transparent);
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

    .session__speaker {
      margin: 0.1rem 0 0;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .session__text {
      margin: 0.35rem 0 0;
      white-space: pre-line;
    }

    .cta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: start;
      margin-block: 1.5rem;
    }

    .cta__button {
      padding: 0.6rem 1.1rem;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
      text-decoration: none;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class EventLandingPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesSlug = input.required<string>();
  readonly eventSlug = input.required<string>();

  private readonly events = inject(PublicEventsService);
  private readonly program = inject(PublicProgramService);
  private readonly config = inject(AppConfigService);

  protected readonly event = signal<PublicEvent | null>(null);
  protected readonly items = signal<readonly PublicProgramItem[]>([]);
  protected readonly error = signal<string | null>(null);

  protected readonly isOver = computed(() => {
    const event = this.event();
    return event ? hasEnded(event) : false;
  });

  /**
   * The programme grouped into days as they are counted at the venue (E8).
   *
   * Empty until the event is known: the zone the days are counted in comes from
   * the event, and grouping in the reader's zone first would move a session
   * across midnight and then move it back.
   */
  protected readonly days = computed<readonly ProgramDay[]>(() => {
    const event = this.event();
    return event
      ? groupProgramByDay(this.items(), event.timezone, this.locale())
      : [];
  });

  protected readonly pluginContext = computed(() => ({
    eventId: this.event()?.id ?? '',
    locale: this.config.config()?.defaultLocale ?? 'en',
  }));

  constructor() {
    effect(() => {
      void this.load(this.seriesSlug(), this.eventSlug());
    });
  }

  protected when(): string {
    const event = this.event();
    return event ? formatEventPeriod(event, this.locale()) : '';
  }

  /** The session's clock range, in the event's zone — never the reader's (E8). */
  protected clock(item: PublicProgramItem): string {
    const event = this.event();
    return event ? formatProgramTime(item, event.timezone, this.locale()) : '';
  }

  /** Spelled out rather than shown as a raw enum value. */
  protected format(): string {
    switch (this.event()?.eventType) {
      case 'online':
        return 'Online';
      case 'hybrid':
        return 'On site and online';
      default:
        return 'On site';
    }
  }

  private locale(): string {
    return this.config.config()?.defaultLocale ?? 'en';
  }

  private async load(seriesSlug: string, eventSlug: string): Promise<void> {
    this.error.set(null);
    this.items.set([]);
    try {
      this.event.set(await this.events.get(seriesSlug, eventSlug));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event does not exist, or is not public yet.'
          : ((error as ApiError)?.message ?? 'The event could not be loaded.'),
      );
      return;
    }

    // After the event and never before it: the days are counted in the event's
    // zone. A programme that cannot be loaded leaves the page standing — the
    // event's own facts are the part somebody came for.
    try {
      this.items.set(await this.program.list(seriesSlug, eventSlug));
    } catch {
      this.items.set([]);
    }
  }
}
