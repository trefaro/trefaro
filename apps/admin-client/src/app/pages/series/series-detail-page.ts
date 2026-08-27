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
import type { ApiError } from '@trefaro/shared-http';
import type { EventSeries, OrganizerEvent } from '@trefaro/shared-models';
import { formatEventPeriod, hasEnded } from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';

/**
 * One event series with its events, split into upcoming and past (FR 2.3).
 *
 * This is also where a series is deleted, rather than from the list: the events
 * that would go with it are on screen here, so the confirmation can say what is
 * actually at stake instead of asking the organizer to remember.
 */
@Component({
  selector: 'trefaro-series-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    @if (series(); as item) {
      <header class="head">
        <div>
          <h1>{{ item.name }}</h1>
          <p class="meta">
            <span class="status" [class]="'status--' + item.status">
              {{ item.status }}
            </span>
            <code>/series/{{ item.slug }}</code>
          </p>
        </div>
        <div class="head__actions">
          <a
            class="button"
            [routerLink]="['/series', item.id, 'events', 'new']"
          >
            New event
          </a>
          <a [routerLink]="['/series', item.id, 'edit']">Edit series</a>
          <button type="button" (click)="removeSeries(item)">
            Delete series
          </button>
        </div>
      </header>

      <section>
        <h2>Upcoming events</h2>
        @if (upcoming().length === 0) {
          <p class="meta">
            {{
              loading()
                ? 'Loading…'
                : 'No upcoming events. Create the first one.'
            }}
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>When</th>
                <th>Type</th>
                <th>Status</th>
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
                  <td>{{ event.eventType }}</td>
                  <td>
                    <span class="status" [class]="'status--' + event.status">
                      {{ event.status }}
                    </span>
                  </td>
                  <td class="actions">
                    @if (event.status === 'published') {
                      <button type="button" (click)="setStatus(event, 'draft')">
                        Unpublish
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="setStatus(event, 'published')"
                      >
                        Publish
                      </button>
                    }
                    <button type="button" (click)="removeEvent(event)">
                      Delete
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
          <h2>Past events</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>When</th>
                <th>Type</th>
                <th>Status</th>
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
                  <td>{{ event.eventType }}</td>
                  <td>
                    <span class="status" [class]="'status--' + event.status">
                      {{ event.status }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      <p><a routerLink="/">Back to all series</a></p>
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

  protected readonly series = signal<EventSeries | null>(null);
  protected readonly events = signal<readonly OrganizerEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
    return formatEventPeriod(event);
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
    if (!confirm(`Delete the event "${event.name}"?`)) return;
    void this.run(async () => {
      await this.eventsAdmin.remove(event.id);
      await this.load(this.id());
    });
  }

  protected removeSeries(series: EventSeries): void {
    const count = this.events().length;
    const consequence =
      count === 0
        ? ''
        : ` Its ${count} event${count === 1 ? '' : 's'} will be deleted too.`;
    if (!confirm(`Delete the event series "${series.name}"?${consequence}`)) {
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
          ? 'This event series no longer exists.'
          : ((error as ApiError)?.message ?? 'Loading failed.'),
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
      this.error.set((error as ApiError)?.message ?? 'The request failed.');
    }
  }
}
