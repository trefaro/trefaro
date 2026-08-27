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
import type { PublicEvent, PublicEventSeries } from '@trefaro/shared-models';
import { formatEventPeriod, hasEnded } from '@trefaro/shared-models';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';
import { PublicEventsService } from '../../features/events/public-events.service';

/**
 * One event series, without a login (UC 03 seen from the participant side).
 *
 * Lists the series' upcoming and past events (FR 2.3). Past events stay
 * visible rather than disappearing: for a series that runs every year, the
 * previous editions are what tells a newcomer what they are signing up for.
 */
@Component({
  selector: 'trefaro-series-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (error()) {
      <p class="notice" role="alert">{{ error() }}</p>
    } @else if (series(); as item) {
      <article>
        <header class="head">
          @if (item.logoUrl) {
            <img class="head__logo" [src]="item.logoUrl" alt="" />
          }
          <h1>{{ item.name }}</h1>
        </header>

        <p class="description">{{ item.description }}</p>

        @if (item.websiteUrl) {
          <p>
            <a [href]="item.websiteUrl" rel="noopener noreferrer">
              More about this series
            </a>
          </p>
        }
        @if (item.contactEmail) {
          <p>
            Questions:
            <a [href]="'mailto:' + item.contactEmail">{{
              item.contactEmail
            }}</a>
          </p>
        }

        <h2>Upcoming events</h2>
        @if (upcoming().length === 0) {
          <p class="notice">
            {{
              loadingEvents()
                ? 'Loading…'
                : 'No upcoming events are announced yet.'
            }}
          </p>
        } @else {
          <ul class="events">
            @for (event of upcoming(); track event.id) {
              <li>
                <a
                  class="event"
                  [routerLink]="['/series', item.slug, 'events', event.slug]"
                >
                  <span class="event__name">{{ event.name }}</span>
                  <span class="event__when">{{ when(event) }}</span>
                  <span class="event__where">{{ where(event) }}</span>
                </a>
              </li>
            }
          </ul>
        }

        @if (past().length > 0) {
          <h2>Past events</h2>
          <ul class="events">
            @for (event of past(); track event.id) {
              <li>
                <a
                  class="event event--past"
                  [routerLink]="['/series', item.slug, 'events', event.slug]"
                >
                  <span class="event__name">{{ event.name }}</span>
                  <span class="event__when">{{ when(event) }}</span>
                </a>
              </li>
            }
          </ul>
        }
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

    .description {
      max-inline-size: 40rem;
      white-space: pre-line;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .events {
      display: grid;
      gap: 0.6rem;
      padding: 0;
      margin: 0;
      list-style: none;
      max-inline-size: 40rem;
    }

    .event {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.75rem 0.9rem;
      border-radius: 0.6rem;
      background: var(--trefaro-color-surface, #fff);
      box-shadow: 0 1px 2px rgb(0 0 0 / 14%);
      color: inherit;
      text-decoration: none;
    }

    .event--past {
      opacity: 0.75;
    }

    .event__name {
      font-weight: 600;
    }

    .event__when,
    .event__where {
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }
  `,
})
export class SeriesDetailPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly slug = input.required<string>();

  private readonly seriesService = inject(PublicEventSeriesService);
  private readonly eventsService = inject(PublicEventsService);
  private readonly config = inject(AppConfigService);

  protected readonly series = signal<PublicEventSeries | null>(null);
  protected readonly events = signal<readonly PublicEvent[]>([]);
  protected readonly loadingEvents = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Split on the end: a three-day event is not past on its second morning. */
  protected readonly upcoming = computed(() =>
    this.events().filter((event) => !hasEnded(event)),
  );
  protected readonly past = computed(() =>
    // Most recent first — the previous edition is the interesting one.
    this.events()
      .filter((event) => hasEnded(event))
      .slice()
      .reverse(),
  );

  constructor() {
    effect(() => {
      void this.load(this.slug());
    });
  }

  protected when(event: PublicEvent): string {
    return formatEventPeriod(event, this.config.config()?.defaultLocale ?? 'en');
  }

  protected where(event: PublicEvent): string {
    if (event.eventType === 'online') return 'Online';
    const place = event.venueName ?? 'On site';
    return event.eventType === 'hybrid' ? `${place} and online` : place;
  }

  private async load(slug: string): Promise<void> {
    this.error.set(null);
    this.loadingEvents.set(true);
    try {
      const [series, events] = await Promise.all([
        this.seriesService.bySlug(slug),
        this.eventsService.listBySeries(slug),
      ]);
      this.series.set(series);
      this.events.set(events);
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event series does not exist, or is not public yet.'
          : ((error as ApiError)?.message ??
              'The event series could not be loaded.'),
      );
    } finally {
      this.loadingEvents.set(false);
    }
  }
}
