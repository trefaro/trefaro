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
import type { PublicEvent } from '@trefaro/shared-models';
import { formatEventPeriod, hasEnded } from '@trefaro/shared-models';
import { PluginSlot } from '@trefaro/shared-plugins';
import { PublicEventsService } from '../../features/events/public-events.service';

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
 * whose 09:00 this is.
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

        @if (!isOver()) {
          <!-- The form behind this arrives in AP 4, together with the
               double-opt-in mail. Announcing the step already is honest; a
               button that silently does nothing would not be. -->
          <p class="cta">
            <button type="button" disabled>Register now</button>
            <small>Registration opens with the next release.</small>
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

    .cta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: start;
      margin-block: 1.5rem;
    }

    .cta button {
      padding: 0.6rem 1.1rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
    }

    .cta button:disabled {
      opacity: 0.55;
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
  private readonly config = inject(AppConfigService);

  protected readonly event = signal<PublicEvent | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly isOver = computed(() => {
    const event = this.event();
    return event ? hasEnded(event) : false;
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
    return event
      ? formatEventPeriod(event, this.config.config()?.defaultLocale ?? 'en')
      : '';
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

  private async load(seriesSlug: string, eventSlug: string): Promise<void> {
    this.error.set(null);
    try {
      this.event.set(await this.events.get(seriesSlug, eventSlug));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event does not exist, or is not public yet.'
          : ((error as ApiError)?.message ?? 'The event could not be loaded.'),
      );
    }
  }
}
