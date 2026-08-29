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
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
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
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
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
              {{ 'series.website' | transloco }}
            </a>
          </p>
        }
        @if (item.contactEmail) {
          <p>
            {{ 'series.questions' | transloco }}
            <a [href]="'mailto:' + item.contactEmail">{{
              item.contactEmail
            }}</a>
          </p>
        }

        <h2>{{ 'series.upcoming' | transloco }}</h2>
        @if (upcoming().length === 0) {
          <p class="notice">
            {{
              (loadingEvents() ? 'common.loading' : 'series.noUpcoming')
                | transloco
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
          <h2>{{ 'series.past' | transloco }}</h2>
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
      <p class="notice">{{ 'common.loading' | transloco }}</p>
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
  private readonly i18n = inject(TranslationService);

  protected readonly series = signal<PublicEventSeries | null>(null);
  protected readonly events = signal<readonly PublicEvent[]>([]);
  protected readonly loadingEvents = signal(true);
  protected readonly error = signal<Problem | null>(null);

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
    // The language is read here so a switch re-runs the effect: names and
    // descriptions are translated on the server (FR 3.12), and a page that only
    // re-rendered would keep the sentences it already had.
    effect(() => {
      void this.load(this.slug(), this.i18n.locale());
    });
  }

  /**
   * The period, in the language the reader is reading (E8 untouched).
   *
   * The *reader's* language rather than the instance's default: the zone stays
   * the event's, which is what E8 fixes, but "17. September" and "17 September"
   * are the same instant written for two different people.
   */
  protected when(event: PublicEvent): string {
    return formatEventPeriod(event, this.i18n.locale());
  }

  /**
   * Where it happens, assembled from the catalogue.
   *
   * A method rather than a `computed()`, and that is what makes it redraw: a
   * template method is re-evaluated whenever its view is, and the `transloco`
   * pipes on this page mark the view on a language change. A `computed()` would
   * be memoised and would have to read {@link TranslationService.locale} itself
   * — the distinction F72 is about.
   */
  protected where(event: PublicEvent): string {
    if (event.eventType === 'online') {
      return this.i18n.translate('event.online');
    }
    const place = event.venueName ?? this.i18n.translate('event.onSite');
    return event.eventType === 'hybrid'
      ? this.i18n.translate('series.placeAndOnline', { place })
      : place;
  }

  private async load(slug: string, locale: string): Promise<void> {
    this.error.set(null);
    this.loadingEvents.set(true);
    try {
      const [series, events] = await Promise.all([
        this.seriesService.bySlug(slug, locale),
        this.eventsService.listBySeries(slug, locale),
      ]);
      this.series.set(series);
      this.events.set(events);
    } catch (error: unknown) {
      // A 404 needs no reason from the server: this client already knows the
      // only two it can be, and repeating "Not Found" underneath would be noise.
      this.error.set(
        (error as ApiError)?.status === 404
          ? { key: 'series.errorMissing', detail: null }
          : problemOf(error, 'series.error'),
      );
    } finally {
      this.loadingEvents.set(false);
    }
  }
}
