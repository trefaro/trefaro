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
import type { ApiError } from '@trefaro/shared-http';
import type { EventDashboard, OrganizerEvent } from '@trefaro/shared-models';
import {
  formatEventPeriod,
  formatInstant,
  publicEventPath,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';

/**
 * The dashboard of one event (FR 3.8, UC 05) — an event's home.
 *
 * The mockups draw KPI tiles that are links, plus a table of the latest
 * registrations. Four decisions about this page are worth naming:
 *
 * 1. **Every tile is a link to the view it summarizes.** A number an organizer
 *    cannot act on is decoration. The whole tile is the hit area, but there is
 *    exactly one real link inside it — the heading — so what a screen reader
 *    announces is "Participants", not the number read out as part of the name.
 * 2. **No tile for a module that does not exist yet.** The mockup's tiles for
 *    new messages (phase 3) and for programme proposals and the forum (phase 4)
 *    are absent rather than showing a hard zero: a zero is a claim about data,
 *    and a dashboard full of zeros teaches an organizer to stop reading it. The
 *    grid reflows when they arrive.
 * 3. **The e-mail address is in the table.** Same rule as in the participant
 *    overview (E13) — the next thing an organizer does after seeing a new
 *    registration is write to the person.
 * 4. **The public address is shown, not linked.** The participant client is a
 *    different origin, and this client is not told which one (that arrives with
 *    the configuration work of phase 2). A link that works in production and
 *    404s in development would be worse than the address itself.
 */
@Component({
  selector: 'trefaro-event-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    @if (dashboard(); as view) {
      <header class="head">
        <div>
          <h1>{{ view.event.name }}</h1>
          <p class="meta">
            <span class="status" [class]="'status--' + view.event.status">
              {{ view.event.status }}
            </span>
            <span>{{ when() }}</span>
            <code>{{ address() }}</code>
          </p>
        </div>
        <div class="head__actions">
          <a
            class="button"
            [routerLink]="['/series', seriesId(), 'events', eventId(), 'edit']"
          >
            Edit event
          </a>
          @if (view.event.status === 'published') {
            <button type="button" (click)="setStatus('draft')">
              Unpublish
            </button>
          } @else {
            <button type="button" (click)="setStatus('published')">
              Publish
            </button>
          }
          <a [routerLink]="['/series', seriesId()]">Back to the series</a>
        </div>
      </header>

      <section class="tiles" aria-label="Summary">
        <article class="tile">
          <h2>
            <a
              [routerLink]="[
                '/series',
                seriesId(),
                'events',
                eventId(),
                'participants',
              ]"
            >
              Participants
            </a>
          </h2>
          <p class="tile__value">
            {{ view.registrations.confirmed }}
            <span class="tile__unit">confirmed</span>
          </p>
          <p class="tile__meta">{{ participantsMeta() }}</p>
        </article>

        <article class="tile">
          <h2>
            <a
              [routerLink]="[
                '/series',
                seriesId(),
                'events',
                eventId(),
                'program',
              ]"
            >
              Programme
            </a>
          </h2>
          <p class="tile__value">
            {{ view.program.items }}
            <span class="tile__unit">
              {{ view.program.items === 1 ? 'session' : 'sessions' }}
            </span>
          </p>
          <p class="tile__meta">{{ programMeta() }}</p>
        </article>

        <article class="tile">
          <h2>
            <a
              [routerLink]="[
                '/series',
                seriesId(),
                'events',
                eventId(),
                'registration-form',
              ]"
            >
              Registration form
            </a>
          </h2>
          <p class="tile__value">
            {{ view.form.questions }}
            <span class="tile__unit">
              {{
                view.form.questions === 1 ? 'extra question' : 'extra questions'
              }}
            </span>
          </p>
          <p class="tile__meta">{{ formMeta() }}</p>
        </article>
        <!-- The tiles for messages (phase 3) and for the proposal and forum
             plug-ins (phase 4) appear here. Deliberately not present as zeros
             while the modules do not exist. -->
      </section>

      <section>
        <div class="section-head">
          <h2>Latest registrations</h2>
          <a
            [routerLink]="[
              '/series',
              seriesId(),
              'events',
              eventId(),
              'participants',
            ]"
          >
            All participants
          </a>
        </div>

        @if (latest().length === 0) {
          <p class="meta">
            {{
              loading()
                ? 'Loading…'
                : 'Nobody has registered for this event yet.'
            }}
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <!-- In the table, not behind a click (E13). -->
                <th>E-mail</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              @for (row of latest(); track row.id) {
                <tr>
                  <td>{{ row.lastName }}, {{ row.firstName }}</td>
                  <td>{{ row.email }}</td>
                  <td>
                    <span class="status" [class]="'status--' + row.status">
                      {{ row.status }}
                    </span>
                  </td>
                  <td>{{ registeredAt(row.registeredAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    } @else if (loading()) {
      <p class="meta">Loading…</p>
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
      flex-wrap: wrap;
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

    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 1rem;
      margin-block: 1.5rem;
    }

    .tile {
      position: relative;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
    }

    .tile h2 {
      margin: 0;
      font-size: 1rem;
    }

    /* One real link per tile, stretched over the whole card: the tile is a
       link, and what gets announced is still just its name. */
    .tile h2 a::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }

    .tile:hover {
      border-color: var(--trefaro-color-primary);
    }

    .tile__value {
      margin-block: 0.4rem 0.2rem;
      font-size: 2rem;
      font-weight: 600;
      line-height: 1.1;
    }

    .tile__unit {
      font-size: 0.9rem;
      font-weight: 400;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .tile__meta {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
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

    .status--published,
    .status--confirmed {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 22%,
        transparent
      );
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
export class EventDashboardPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  private readonly events = inject(EventsAdminService);

  protected readonly dashboard = signal<EventDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly event = computed(() => this.dashboard()?.event ?? null);
  protected readonly latest = computed(
    () => this.dashboard()?.latestRegistrations ?? [],
  );

  constructor() {
    effect(() => {
      void this.load(this.eventId());
    });
  }

  /** The period in the event's own zone, never the browser's (E8). */
  protected when(): string {
    const event = this.event();
    return event ? formatEventPeriod(event) : '';
  }

  protected address(): string {
    const view = this.dashboard();
    return view ? publicEventPath(view.seriesSlug, view.event.slug) : '';
  }

  protected registeredAt(iso: string): string {
    const zone = this.event()?.timezone;
    return zone ? formatInstant(iso, zone) : iso;
  }

  /**
   * What is not confirmed yet, and what will not come.
   *
   * Named rather than shown as two more numbers: "4 · 1" under a heading would
   * make an organizer count columns to find out which is which.
   */
  protected participantsMeta(): string {
    const counts = this.dashboard()?.registrations;
    if (!counts) return '';
    if (counts.total === 0) return 'Nobody has registered yet.';

    const parts: string[] = [];
    if (counts.pending > 0) {
      parts.push(`${counts.pending} awaiting confirmation`);
    }
    if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);
    return parts.length > 0
      ? parts.join(' · ')
      : 'Every registration is confirmed.';
  }

  protected programMeta(): string {
    const program = this.dashboard()?.program;
    if (!program) return '';
    if (program.items === 0) return 'No programme yet.';
    if (program.withSignup === 0) return 'No session asks who is coming.';

    const seats = program.signups === 1 ? 'seat' : 'seats';
    const sessions = program.withSignup === 1 ? 'session' : 'sessions';
    return (
      `${program.signups} ${seats} taken in ` +
      `${program.withSignup} ${sessions}`
    );
  }

  protected formMeta(): string {
    const form = this.dashboard()?.form;
    if (!form) return '';
    if (form.questions === 0) return 'Only the standard fields.';
    return form.required === 0
      ? 'None of them required.'
      : `${form.required} of them required.`;
  }

  protected setStatus(status: OrganizerEvent['status']): void {
    void this.run(async () => {
      await this.events.update(this.eventId(), { status });
      await this.load(this.eventId());
    });
  }

  private async load(eventId: string): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      this.dashboard.set(await this.events.dashboard(eventId));
    } catch (error: unknown) {
      this.dashboard.set(null);
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event no longer exists.'
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
