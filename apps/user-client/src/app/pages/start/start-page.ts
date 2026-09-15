import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationService } from '@trefaro/shared-i18n';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import type { PublicEventSeries } from '@trefaro/shared-models';
import { NewsletterSignup } from '../../features/newsletter/newsletter-signup';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';

/**
 * Start page of the participant client — the event series overview (FR 2.3).
 *
 * Reachable without a login, deliberately: anyone can see what an organization
 * is running before deciding to register.
 *
 * Since AP 12 it also carries the newsletter sign-up (FR 4.8) — the one that
 * belongs to no series, because this page belongs to none either. The other
 * placement is a series' own page, and it signs up for that series.
 */
@Component({
  selector: 'trefaro-start-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NewsletterSignup, RouterLink, TranslocoPipe],
  template: `
    <h1>{{ 'start.title' | transloco }}</h1>

    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.reason; as reason) {
          <span class="notice__detail">{{
            reason.code | transloco: reason.params
          }}</span>
        }
      </p>
    } @else if (loading()) {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    } @else if (series().length === 0) {
      <p class="notice">{{ 'start.empty' | transloco }}</p>
    } @else {
      <ul class="series">
        @for (item of series(); track item.id) {
          <li class="series__item">
            <a class="series__link" [routerLink]="['/series', item.slug]">
              @if (item.logoUrl) {
                <img class="series__logo" [src]="item.logoUrl" alt="" />
              }
              <span class="series__body">
                <span class="series__name">{{ item.name }}</span>
                <span class="series__description">{{ item.description }}</span>
              </span>
            </a>
          </li>
        }
      </ul>
    }

    <!-- Without a series, so this is the instance-wide list (E45). The
         component draws nothing while the module is off. -->
    <trefaro-newsletter-signup />
  `,
  styles: `
    .notice {
      color: var(--trefaro-color-primary-strong);
      max-inline-size: 40rem;
    }

    .series {
      display: grid;
      gap: 0.75rem;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .series__link {
      display: flex;
      gap: 0.9rem;
      align-items: start;
      padding: 0.9rem 1rem;
      border-radius: 0.6rem;
      background: var(--trefaro-color-surface, #fff);
      box-shadow: 0 1px 2px rgb(0 0 0 / 14%);
      color: inherit;
      text-decoration: none;
    }

    .series__logo {
      inline-size: 3rem;
      block-size: 3rem;
      object-fit: contain;
      flex: none;
    }

    .series__body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-inline-size: 0;
    }

    .series__name {
      font-weight: 600;
      font-size: 1.05rem;
    }

    .series__description {
      /* Mobile-first: two lines are enough to judge whether to tap. */
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
  `,
})
export class StartPage {
  private readonly seriesService = inject(PublicEventSeriesService);
  private readonly i18n = inject(TranslationService);

  protected readonly series = signal<readonly PublicEventSeries[]>([]);
  protected readonly loading = signal(true);

  /**
   * What went wrong, as a key plus the server's reason if it gave one (F77).
   *
   * Two halves, because they come from two places: this client says *what* did
   * not work, the server says *why*. Both are catalogue keys since AP 5 of
   * phase 5 (E64), so both are drawn in the language of the reader.
   */
  protected readonly error = signal<Problem | null>(null);

  /**
   * Counts the reads, so a late answer to an earlier one is dropped.
   *
   * Two loads are in flight the moment somebody switches the language before
   * the first one has arrived, and the answers come back in the order of the
   * network. Without this, a slow English answer painted an English list under
   * a German page (AP 5 of phase 5; the landing page has had it since AP 5 of
   * phase 4).
   */
  private loadSequence = 0;

  constructor() {
    // An effect rather than one call: series names and descriptions are
    // translated on the server (FR 3.12), so a language switch has to fetch the
    // list again. Re-rendering alone would keep the sentences it already had.
    effect(() => {
      void this.load(this.i18n.locale());
    });
  }

  private async load(locale: string): Promise<void> {
    const run = ++this.loadSequence;
    try {
      const rows = await this.seriesService.list(locale);
      if (run !== this.loadSequence) return;
      this.series.set(rows);
    } catch (error: unknown) {
      if (run !== this.loadSequence) return;
      this.error.set(
        problemOf(
          error,
          (error as ApiError)?.retryable ? 'start.errorRetry' : 'start.error',
        ),
      );
    } finally {
      if (run === this.loadSequence) this.loading.set(false);
    }
  }
}
