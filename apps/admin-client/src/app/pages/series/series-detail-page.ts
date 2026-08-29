import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { EventSeries, OrganizerEvent } from '@trefaro/shared-models';
import {
  eventSeriesStatusKey,
  eventStatusKey,
  formatEventPeriod,
  hasEnded,
} from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { eventTypeKey } from '../../features/i18n/labels';

/**
 * One event series with its events, split into upcoming and past (FR 2.3).
 *
 * This is also where a series is deleted, rather than from the list: the events
 * that would go with it are on screen here, so the confirmation can say what is
 * actually at stake instead of asking the organizer to remember.
 *
 * And it is the way to the invitations (FR 2.4), which belong to the series
 * rather than to one of its events: the addresses come from every event of the
 * series, and the invitation usually goes out before the next one exists.
 */
@Component({
  selector: 'trefaro-series-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (series(); as item) {
      <header class="head">
        <div>
          <h1>{{ item.name }}</h1>
          <p class="meta">
            <span class="status" [class]="'status--' + item.status">
              {{ seriesStatusKey(item.status) | transloco }}
            </span>
            <code>/series/{{ item.slug }}</code>
          </p>
        </div>
        <div class="head__actions">
          <a
            class="button"
            [routerLink]="['/series', item.id, 'events', 'new']"
          >
            {{ 'admin.events.new' | transloco }}
          </a>
          <a [routerLink]="['/series', item.id, 'invitations']">
            {{ 'admin.invitations.title' | transloco }}
          </a>
          <a [routerLink]="['/series', item.id, 'translations']">
            {{ 'admin.translations.link' | transloco }}
          </a>
          <a [routerLink]="['/series', item.id, 'edit']">
            {{ 'admin.series.editSeries' | transloco }}
          </a>
          <button type="button" (click)="removeSeries(item)">
            {{ 'admin.series.deleteSeries' | transloco }}
          </button>
        </div>
      </header>

      <section>
        <h2>{{ 'admin.series.upcoming' | transloco }}</h2>
        @if (upcoming().length === 0) {
          <p class="meta">
            {{
              (loading() ? 'common.loading' : 'admin.series.noUpcoming')
                | transloco
            }}
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>{{ 'admin.series.name' | transloco }}</th>
                <th>{{ 'admin.series.when' | transloco }}</th>
                <th>{{ 'admin.series.type' | transloco }}</th>
                <th>{{ 'admin.series.status' | transloco }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (event of upcoming(); track event.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/series', item.id, 'events', event.id]">
                      {{ event.name }}
                    </a>
                  </td>
                  <td>{{ when(event) }}</td>
                  <td>{{ typeKey(event.eventType) | transloco }}</td>
                  <td>
                    <span class="status" [class]="'status--' + event.status">
                      {{ statusKey(event.status) | transloco }}
                    </span>
                  </td>
                  <td class="actions">
                    <a
                      [routerLink]="[
                        '/series',
                        item.id,
                        'events',
                        event.id,
                        'participants',
                      ]"
                    >
                      {{ 'admin.participants.title' | transloco }}
                    </a>
                    @if (event.status === 'published') {
                      <button type="button" (click)="setStatus(event, 'draft')">
                        {{ 'admin.series.unpublish' | transloco }}
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="setStatus(event, 'published')"
                      >
                        {{ 'admin.series.publish' | transloco }}
                      </button>
                    }
                    <button type="button" (click)="removeEvent(event)">
                      {{ 'admin.common.delete' | transloco }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      @if (past().length > 0) {
        <section>
          <h2>{{ 'admin.series.past' | transloco }}</h2>
          <table>
            <thead>
              <tr>
                <th>{{ 'admin.series.name' | transloco }}</th>
                <th>{{ 'admin.series.when' | transloco }}</th>
                <th>{{ 'admin.series.type' | transloco }}</th>
                <th>{{ 'admin.series.status' | transloco }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (event of past(); track event.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/series', item.id, 'events', event.id]">
                      {{ event.name }}
                    </a>
                  </td>
                  <td>{{ when(event) }}</td>
                  <td>{{ typeKey(event.eventType) | transloco }}</td>
                  <td>
                    <span class="status" [class]="'status--' + event.status">
                      {{ statusKey(event.status) | transloco }}
                    </span>
                  </td>
                  <td class="actions">
                    <!-- Past events are where the participant list matters most:
                         the follow-up mail of AP 11 is written from it. -->
                    <a
                      [routerLink]="[
                        '/series',
                        item.id,
                        'events',
                        event.id,
                        'participants',
                      ]"
                    >
                      {{ 'admin.participants.title' | transloco }}
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      <p>
        <a routerLink="/">{{ 'admin.series.backToList' | transloco }}</a>
      </p>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .head__actions {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .meta {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .button {
      padding: 0.5rem 0.9rem;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
      text-decoration: none;
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
    }

    .status {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.85rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
    }

    .status--published {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 22%,
        transparent
      );
    }

    .actions {
      display: flex;
      gap: 0.4rem;
      justify-content: end;
    }

    button {
      padding: 0.3rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class SeriesDetailPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly seriesAdmin = inject(EventSeriesAdminService);
  private readonly eventsAdmin = inject(EventsAdminService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

  protected readonly series = signal<EventSeries | null>(null);
  protected readonly events = signal<readonly OrganizerEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<Problem | null>(null);

  protected readonly seriesStatusKey = eventSeriesStatusKey;
  protected readonly statusKey = eventStatusKey;
  protected readonly typeKey = eventTypeKey;

  /**
   * Split on the end, not the start: a three-day conference is not "past" on
   * its second morning.
   */
  protected readonly upcoming = computed(() =>
    this.events().filter((event) => !hasEnded(event)),
  );
  protected readonly past = computed(() =>
    // Most recent first — the last event is the one an organizer looks up.
    this.events()
      .filter((event) => hasEnded(event))
      .slice()
      .reverse(),
  );

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  protected when(event: OrganizerEvent): string {
    return formatEventPeriod(event, this.i18n.locale());
  }

  protected setStatus(
    event: OrganizerEvent,
    status: OrganizerEvent['status'],
  ): void {
    void this.run(async () => {
      await this.eventsAdmin.update(event.id, { status });
      await this.load(this.id());
    });
  }

  protected removeEvent(event: OrganizerEvent): void {
    const question = this.i18n.translate('admin.series.confirmDeleteEvent', {
      name: event.name,
    });
    if (!confirm(question)) return;
    void this.run(async () => {
      await this.eventsAdmin.remove(event.id);
      await this.load(this.id());
    });
  }

  protected removeSeries(series: EventSeries): void {
    const count = this.events().length;
    // Two sentences rather than one with a clause in it: a plural is a second
    // key here (the same shape as the participant client's counted labels), and
    // a series with no events must not be told about the events it has none of.
    const consequence =
      count === 0
        ? ''
        : ` ${this.i18n.translate(
            count === 1
              ? 'admin.series.confirmDeleteEvents.one'
              : 'admin.series.confirmDeleteEvents.many',
            { count },
          )}`;
    const question = this.i18n.translate('admin.series.confirmDelete', {
      name: series.name,
    });
    if (!confirm(`${question}${consequence}`)) {
      return;
    }

    void this.run(async () => {
      await this.seriesAdmin.remove(series.id);
      await this.router.navigate(['/']);
    });
  }

  private async load(id: string): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const [series, events] = await Promise.all([
        this.seriesAdmin.get(id),
        this.eventsAdmin.listBySeries(id),
      ]);
      this.series.set(series);
      this.events.set(events);
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? { key: 'admin.series.errorMissing', detail: null }
          : problemOf(error, 'admin.common.loadingFailed'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.common.requestFailed'));
    }
  }
}
