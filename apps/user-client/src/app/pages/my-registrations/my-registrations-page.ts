import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { MyRegistrationSummary } from '@trefaro/shared-models';
import {
  formatEventPeriod,
  registrationStatusKey,
} from '@trefaro/shared-models';
import { SelfServiceService } from '../../features/self-service/self-service.service';

/**
 * "My registrations" — the page a logged-in participant reaches (FR 4.7).
 *
 * The screen phase 1 could not have: a token speaks for one registration, so
 * until there were accounts there was nothing to list. Found by address
 * equality (E31), which is what makes the rows written before somebody had an
 * account belong to them the day they sign up.
 *
 * Every state is listed, and each one says what to do about itself: a pending
 * registration points back at the mail nobody has clicked yet, a cancelled one
 * says so. Only a confirmed registration has a page behind it — the same rule
 * the mailed link follows — so the others are rows and not links.
 *
 * Paged with a button rather than with numbers. Most people have two or three
 * registrations; a pager would be more machinery on screen than there are rows
 * behind it.
 */
@Component({
  selector: 'trefaro-my-registrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <h1>{{ 'mine.list.title' | transloco }}</h1>

    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (loaded()) {
      @if (rows().length === 0) {
        <p>{{ 'mine.list.empty' | transloco }}</p>
        <p>
          <a routerLink="/">{{ 'event.backToSeriesList' | transloco }}</a>
        </p>
      } @else {
        <ul class="entries">
          @for (entry of rows(); track entry.id) {
            <li class="entry">
              <h2 class="entry__title">
                @if (entry.status === 'confirmed') {
                  <a [routerLink]="['/registrations', entry.id]">
                    {{ entry.event.name }}
                  </a>
                } @else {
                  {{ entry.event.name }}
                }
              </h2>
              <p class="entry__when">{{ when(entry) }}</p>
              <p class="entry__status">
                {{ statusKey(entry) | transloco }}
              </p>
              @if (entry.status === 'pending') {
                <p class="meta">{{ 'mine.list.pendingHint' | transloco }}</p>
              } @else if (entry.status === 'cancelled') {
                <p class="meta">{{ 'mine.list.cancelledHint' | transloco }}</p>
              }
              <p class="entry__links">
                <a
                  [routerLink]="[
                    '/series',
                    entry.seriesSlug,
                    'events',
                    entry.event.slug,
                  ]"
                >
                  {{ 'mine.list.eventPage' | transloco }}
                </a>
              </p>
            </li>
          }
        </ul>

        @if (more()) {
          <button type="button" [disabled]="busy()" (click)="loadMore()">
            {{ 'mine.list.more' | transloco }}
          </button>
        }
      }
    } @else if (!error()) {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 40rem;
    }

    .entries {
      display: grid;
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .entry {
      padding: 0.9rem 1rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-md);
    }

    .entry__title {
      margin: 0;
      font-size: 1.05rem;
    }

    .entry__when,
    .entry__status,
    .entry__links {
      margin-block: 0.3rem 0;
    }

    .entry__status {
      font-weight: 600;
    }

    .meta {
      margin-block: 0.3rem 0;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .notice__detail {
      display: block;
      font-size: 0.9rem;
    }

    button {
      margin-block-start: 1rem;
      padding: 0.5rem 0.9rem;
      border: 1px solid var(--trefaro-color-border);
      border-radius: var(--trefaro-radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button:disabled {
      opacity: 0.55;
    }
  `,
})
export class MyRegistrationsPage {
  private readonly selfService = inject(SelfServiceService);
  private readonly i18n = inject(TranslationService);

  protected readonly rows = signal<readonly MyRegistrationSummary[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /**
   * Whether an answer has arrived at all.
   *
   * "No registrations" and "not asked yet" look the same in an empty array, and
   * only one of them is worth a sentence about an empty list (the same
   * distinction as F146, one screen over).
   */
  protected readonly loaded = signal(false);
  private readonly total = signal(0);
  private readonly page = signal(1);

  protected readonly more = computed(() => this.rows().length < this.total());

  constructor() {
    // The language is read here so a switch re-runs the effect: the event names
    // are translated on the server (FR 3.12). A switch starts the list over,
    // because page two in another language is a different page two.
    effect(() => {
      void this.reload(this.i18n.locale());
    });
  }

  protected when(entry: MyRegistrationSummary): string {
    return formatEventPeriod(entry.event, this.i18n.locale());
  }

  /** The state of this registration, as a key rather than a database word. */
  protected statusKey(entry: MyRegistrationSummary): string {
    return registrationStatusKey(entry.status);
  }

  protected async loadMore(): Promise<void> {
    if (this.busy() || !this.more()) return;
    const next = this.page() + 1;
    await this.fetch(next, this.i18n.locale(), true);
  }

  private async reload(locale: string): Promise<void> {
    await this.fetch(1, locale, false);
  }

  private async fetch(
    page: number,
    locale: string,
    append: boolean,
  ): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const answer = await this.selfService.listMine(locale, page);
      this.rows.update((rows) =>
        append ? [...rows, ...answer.rows] : answer.rows,
      );
      this.total.set(answer.total);
      this.page.set(answer.page);
      this.loaded.set(true);
    } catch (error: unknown) {
      // The list that is on screen stays there: a failed second page is no
      // reason to take the first one away.
      if (!append) {
        this.rows.set([]);
        this.loaded.set(false);
      }
      this.error.set(problemOf(error, 'mine.list.error'));
    } finally {
      this.busy.set(false);
    }
  }
}
