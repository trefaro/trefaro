import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { ApiError } from '@trefaro/shared-http';
import type { PublicEventSeries } from '@trefaro/shared-models';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';

/**
 * One event series, without a login (UC 03 seen from the participant side).
 *
 * The list of the series' upcoming and past events (FR 2.3) arrives with the
 * events themselves in AP 3 — this page is where it goes.
 */
@Component({
  selector: 'trefaro-series-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

        <h2>Events</h2>
        <p class="notice">The events of this series appear here.</p>
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
  `,
})
export class SeriesDetailPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly slug = input.required<string>();

  private readonly seriesService = inject(PublicEventSeriesService);

  protected readonly series = signal<PublicEventSeries | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.load(this.slug());
    });
  }

  private async load(slug: string): Promise<void> {
    this.error.set(null);
    try {
      this.series.set(await this.seriesService.bySlug(slug));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event series does not exist, or is not public yet.'
          : ((error as ApiError)?.message ??
              'The event series could not be loaded.'),
      );
    }
  }
}
