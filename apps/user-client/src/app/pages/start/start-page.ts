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
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';

/**
 * Start page of the participant client — the event series overview (FR 2.3).
 *
 * Reachable without a login, deliberately: anyone can see what an organization
 * is running before deciding to register.
 */
@Component({
  selector: 'trefaro-start-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <h1>{{ 'start.title' | transloco }}</h1>

    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
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
   * A sentence assembled here would be English on a German page, so this client
   * says its half in the reader's language and puts the server's half — always
   * English — beside it.
   */
  protected readonly error = signal<Problem | null>(null);

  constructor() {
    // An effect rather than one call: series names and descriptions are
    // translated on the server (FR 3.12), so a language switch has to fetch the
    // list again. Re-rendering alone would keep the sentences it already had.
    effect(() => {
      void this.load(this.i18n.locale());
    });
  }

  private async load(locale: string): Promise<void> {
    try {
      this.series.set(await this.seriesService.list(locale));
    } catch (error: unknown) {
      this.error.set(
        problemOf(
          error,
          (error as ApiError)?.retryable ? 'start.errorRetry' : 'start.error',
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
