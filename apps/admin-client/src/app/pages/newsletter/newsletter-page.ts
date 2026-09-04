import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { NewsletterAudiencePage } from '@trefaro/shared-models';
import {
  NEWSLETTER_MODULE_KEY,
  formatInstant,
  localTimeZone,
  pageCount,
} from '@trefaro/shared-models';
import { NewsletterAudienceService } from '../../features/newsletter/newsletter.service';

/**
 * The newsletter opt-in administration (FR 4.8, E45).
 *
 * What this page says, and why each part of it is here:
 *
 * - **Both sources, in one list, each row saying which it is.** That is the one
 *   job E45 gives this screen. An address that ticked the box while registering
 *   and signed up in the app appears twice, because it said yes twice about two
 *   different things.
 * - **Four numbers, not one.** How many consents, how they split, and how many
 *   distinct addresses — the last is what somebody means when they ask how many
 *   people get the news, and it is smaller than the total exactly when the two
 *   sources overlap.
 * - **A sentence that says nothing is sent from here** (F8). Without it, a list
 *   of addresses with no send button reads like a feature that is missing; with
 *   it, it reads like what it is — the record an organization exports into the
 *   tool it already sends with.
 * - **A delete button only on the app source.** A checkbox in a registration
 *   form belongs to that registration and is administered on the participant
 *   overview; there is nothing on this screen that could take it back without
 *   touching a registration, and pretending otherwise would be worse than the
 *   asymmetry.
 *
 * The one timestamp here belongs to no event, so it is shown in the reader's
 * own zone and language (E8 is about event times, F78 about their spelling).
 */
@Component({
  selector: 'trefaro-newsletter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'admin.newsletter.title' | transloco }}</h1>

    @if (!moduleEnabled()) {
      <p class="hint" role="status">
        {{ 'admin.newsletter.moduleOff' | transloco }}
      </p>
    } @else {
      <p class="hint">{{ 'admin.newsletter.noSending' | transloco }}</p>

      @if (error(); as problem) {
        <p class="error" role="alert">
          {{ problem.key | transloco }}
          @if (problem.detail; as detail) {
            <span class="error__detail">{{ detail }}</span>
          }
        </p>
      }

      @if (result(); as page) {
        <dl class="counts">
          <div>
            <dt>{{ 'admin.newsletter.addresses' | transloco }}</dt>
            <dd>{{ page.counts.addresses }}</dd>
          </div>
          <div>
            <dt>{{ 'admin.newsletter.consents' | transloco }}</dt>
            <dd>{{ page.counts.total }}</dd>
          </div>
          <div>
            <dt>{{ 'admin.newsletter.fromForm' | transloco }}</dt>
            <dd>{{ page.counts.fromForm }}</dd>
          </div>
          <div>
            <dt>{{ 'admin.newsletter.fromApp' | transloco }}</dt>
            <dd>{{ page.counts.fromApp }}</dd>
          </div>
        </dl>

        <table>
          <thead>
            <tr>
              <th>{{ 'admin.newsletter.colEmail' | transloco }}</th>
              <th>{{ 'admin.newsletter.colSource' | transloco }}</th>
              <th>{{ 'admin.newsletter.colScope' | transloco }}</th>
              <th>{{ 'admin.newsletter.colConfirmed' | transloco }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (
              row of page.rows;
              track row.email + row.source + row.seriesId
            ) {
              <tr>
                <td>{{ row.email }}</td>
                <td>
                  {{
                    (row.source === 'app'
                      ? 'admin.newsletter.sourceApp'
                      : 'admin.newsletter.sourceForm'
                    ) | transloco
                  }}
                </td>
                <td>
                  @if (row.seriesName; as name) {
                    {{ name }}
                  } @else {
                    <span class="meta">
                      {{ 'admin.newsletter.instanceWide' | transloco }}
                    </span>
                  }
                </td>
                <td>{{ when(row.confirmedAt) }}</td>
                <td>
                  @if (row.subscriptionId; as id) {
                    <button type="button" (click)="remove(id, row.email)">
                      {{ 'admin.common.delete' | transloco }}
                    </button>
                  } @else {
                    <span class="meta">
                      {{ 'admin.newsletter.inRegistration' | transloco }}
                    </span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">
                  {{
                    (busy() ? 'common.loading' : 'admin.newsletter.empty')
                      | transloco
                  }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        <nav
          class="pager"
          [attr.aria-label]="'admin.newsletter.pages' | transloco"
        >
          <button
            type="button"
            [disabled]="page.page <= 1"
            (click)="goToPage(page.page - 1)"
          >
            {{ 'admin.common.previous' | transloco }}
          </button>
          <span>
            {{
              'admin.newsletter.pageOf'
                | transloco: { page: page.page, pages: pages() }
            }}
          </span>
          <button
            type="button"
            [disabled]="page.page >= pages()"
            (click)="goToPage(page.page + 1)"
          >
            {{ 'admin.common.next' | transloco }}
          </button>
        </nav>
      }
    }
  `,
  styles: `
    .hint {
      max-inline-size: 44rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .counts {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      margin: 1.2rem 0;
    }

    .counts div {
      display: flex;
      flex-direction: column;
    }

    .counts dt {
      font-size: 0.8rem;
      color: color-mix(in oklab, currentColor 65%, transparent);
    }

    .counts dd {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 600;
    }

    table {
      border-collapse: collapse;
      inline-size: 100%;
    }

    th,
    td {
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 15%, transparent);
      text-align: start;
      vertical-align: top;
    }

    .meta {
      color: color-mix(in oklab, currentColor 60%, transparent);
    }

    .pager {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-block-start: 1rem;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class NewsletterPage {
  private readonly newsletter = inject(NewsletterAudienceService);
  private readonly i18n = inject(TranslationService);
  private readonly config = inject(AppConfigService);

  protected readonly result = signal<NewsletterAudiencePage | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  /**
   * From the configuration this client fetched at startup — the same state the
   * server's guard reads (F53), so the table is offered exactly when its
   * endpoint answers.
   */
  protected readonly moduleEnabled = computed(() =>
    this.config.isModuleEnabled(NEWSLETTER_MODULE_KEY),
  );

  protected readonly pages = computed(() => {
    const page = this.result();
    return page ? pageCount(page.total, page.pageSize) : 1;
  });

  constructor() {
    if (this.moduleEnabled()) void this.load(1);
  }

  protected goToPage(page: number): void {
    void this.load(page);
  }

  protected async remove(id: string, email: string): Promise<void> {
    const question = this.i18n.translate('admin.newsletter.confirmDelete', {
      email,
    });
    if (!confirm(question)) return;

    this.error.set(null);
    try {
      await this.newsletter.remove(id);
      await this.load(this.result()?.page ?? 1);
    } catch (failure: unknown) {
      this.error.set(problemOf(failure, 'admin.newsletter.errorDelete'));
    }
  }

  /**
   * A method rather than a `computed()`: it takes an argument, and the pipes on
   * this page mark the view when the language changes, so it is re-evaluated
   * with it (F72).
   */
  protected when(iso: string): string {
    return formatInstant(iso, localTimeZone(), this.i18n.locale());
  }

  private async load(page: number): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.newsletter.page(this.i18n.locale(), page));
    } catch (failure: unknown) {
      this.error.set(problemOf(failure, 'admin.newsletter.errorLoad'));
    } finally {
      this.busy.set(false);
    }
  }
}
