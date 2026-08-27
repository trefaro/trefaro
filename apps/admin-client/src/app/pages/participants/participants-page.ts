import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ApiError } from '@trefaro/shared-http';
import type {
  OrganizerEvent,
  ParticipantDetail,
  ParticipantPage,
  ParticipantQuery,
  ParticipantRow,
  ParticipantSort,
  RegistrationStatistics,
  RegistrationStatus,
  RegistrationWeek,
  SortDirection,
} from '@trefaro/shared-models';
import {
  DEFAULT_PARTICIPANT_SORT,
  DEFAULT_SORT_DIRECTION,
  PARTICIPANT_SORTS,
  REGISTRATION_STATUSES,
  formatInstant,
  pageCount,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { ParticipantsAdminService } from '../../features/registrations/participants-admin.service';

/** Long enough to finish typing a name, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 300;

/** Geometry of the weekly graph, in SVG user units. */
const CHART = { width: 720, height: 120, gap: 2 } as const;

interface Column {
  readonly key: ParticipantSort;
  readonly label: string;
}

const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-mail' },
  { key: 'status', label: 'Status' },
  { key: 'registeredAt', label: 'Registered' },
];

interface Bar extends RegistrationWeek {
  readonly x: number;
  readonly width: number;
  readonly totalY: number;
  readonly totalHeight: number;
  readonly confirmedY: number;
  readonly confirmedHeight: number;
}

/**
 * The participant overview of one event (UC 08, FR 3.3).
 *
 * The highest rated function of the whole survey (3,86/4), so a few things are
 * deliberate rather than incidental:
 *
 * 1. **The e-mail address is a column**, and it is a `mailto:` link. The single
 *    correction the usability test of the thesis produced was that the address
 *    has to be visible without a click — because writing to someone is what an
 *    organizer does next.
 * 2. **The whole view lives in the URL.** Search, filter, sort, page and the
 *    opened registration are query parameters, so a colleague can be sent
 *    exactly what one is looking at, and the browser's back button undoes a
 *    filter instead of leaving the page.
 * 3. **Nothing is filtered or sorted in the browser.** Every keystroke asks the
 *    server for one page. That is what makes the screen behave the same with
 *    twenty registrations and with two thousand.
 */
@Component({
  selector: 'trefaro-participants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <header class="head">
      <div>
        <h1>Participants</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
            <span class="zone">times in {{ item.timezone }}</span>
          }
        </p>
      </div>
      <a class="back" [routerLink]="['/series', seriesId()]">
        Back to the series
      </a>
    </header>

    @if (statistics(); as figures) {
      <section class="chart-section">
        <h2>Registrations per week</h2>
        @if (bars().length === 0) {
          <p class="meta">Nobody has registered yet.</p>
        } @else {
          <svg
            class="chart"
            [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight"
            preserveAspectRatio="none"
            role="img"
            [attr.aria-label]="chartLabel()"
          >
            @for (bar of bars(); track bar.weekStart) {
              <g>
                <title>
                  {{ bar.weekStart }}: {{ bar.total }} registered,
                  {{ bar.confirmed }} confirmed
                </title>
                <rect
                  class="bar bar--total"
                  [attr.x]="bar.x"
                  [attr.y]="bar.totalY"
                  [attr.width]="bar.width"
                  [attr.height]="bar.totalHeight"
                ></rect>
                <rect
                  class="bar bar--confirmed"
                  [attr.x]="bar.x"
                  [attr.y]="bar.confirmedY"
                  [attr.width]="bar.width"
                  [attr.height]="bar.confirmedHeight"
                ></rect>
              </g>
            }
          </svg>
          <p class="legend">
            <span class="swatch swatch--confirmed"></span> confirmed
            <span class="swatch swatch--total"></span> registered
            <span class="meta">
              {{ figures.weeks[0].weekStart }} –
              {{ figures.weeks[figures.weeks.length - 1].weekStart }}
            </span>
          </p>
        }
      </section>
    }

    <section>
      <div class="controls">
        <div class="field">
          <label for="participant-search">Search</label>
          <input
            id="participant-search"
            type="search"
            autocomplete="off"
            placeholder="Name or e-mail"
            [value]="searchText()"
            (input)="onSearch($event)"
          />
        </div>

        <div class="filters" role="group" aria-label="Filter by status">
          @for (option of statusOptions(); track option.value) {
            <button
              type="button"
              class="chip"
              [class.chip--on]="option.value === statusFilter()"
              [attr.aria-pressed]="option.value === statusFilter()"
              (click)="filterBy(option.value)"
            >
              {{ option.label }} ({{ option.count }})
            </button>
          }
        </div>
      </div>

      <table>
        <thead>
          <tr>
            @for (column of columns; track column.key) {
              <th [attr.aria-sort]="ariaSort(column.key)">
                <button type="button" class="sort" (click)="sortBy(column.key)">
                  {{ column.label }}{{ sortMarker(column.key) }}
                </button>
              </th>
            }
            <th>Newsletter</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr [class.row--selected]="row.id === selectedId()">
              <td>
                <a
                  [routerLink]="[]"
                  [queryParams]="{ selected: row.id }"
                  queryParamsHandling="merge"
                >
                  {{ row.lastName }}, {{ row.firstName }}
                </a>
              </td>
              <td>
                <!-- Visible without a click, and one click away from writing. -->
                <a [href]="'mailto:' + row.email">{{ row.email }}</a>
              </td>
              <td>
                <span class="status" [class]="'status--' + row.status">
                  {{ row.status }}
                </span>
              </td>
              <td>{{ when(row.registeredAt) }}</td>
              <td>{{ row.newsletterOptIn ? 'yes' : '—' }}</td>
              <td class="actions">
                @if (row.status === 'cancelled') {
                  <button type="button" (click)="reinstate(row)">
                    Reinstate
                  </button>
                } @else {
                  <button type="button" (click)="cancel(row)">Cancel</button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="meta">{{ emptyMessage() }}</td>
            </tr>
          }
        </tbody>
      </table>

      <nav class="pager" aria-label="Pages">
        <button
          type="button"
          [disabled]="pageNumber() <= 1"
          (click)="goToPage(pageNumber() - 1)"
        >
          Previous
        </button>
        <span>Page {{ pageNumber() }} of {{ pages() }}</span>
        <button
          type="button"
          [disabled]="pageNumber() >= pages()"
          (click)="goToPage(pageNumber() + 1)"
        >
          Next
        </button>
        <span class="meta">{{ matchLabel() }}</span>
      </nav>
    </section>

    @if (detail(); as person) {
      <aside class="detail" aria-labelledby="detail-heading">
        <header>
          <h2 id="detail-heading">
            {{ person.firstName }} {{ person.lastName }}
          </h2>
          <a
            [routerLink]="[]"
            [queryParams]="{ selected: null }"
            queryParamsHandling="merge"
          >
            Close
          </a>
        </header>
        <dl>
          <dt>E-mail</dt>
          <dd>
            <a [href]="'mailto:' + person.email">{{ person.email }}</a>
          </dd>
          <dt>Phone</dt>
          <dd>{{ person.phone ?? '—' }}</dd>
          <dt>Coming from</dt>
          <dd>{{ person.origin ?? '—' }}</dd>
          <dt>Status</dt>
          <dd>{{ person.status }}</dd>
          <dt>Registered</dt>
          <dd>{{ when(person.registeredAt) }}</dd>
          <dt>Confirmed</dt>
          <dd>
            {{ person.confirmedAt ? when(person.confirmedAt) : 'not yet' }}
          </dd>
          <dt>Newsletter</dt>
          <dd>{{ person.newsletterOptIn ? 'yes' : 'no' }}</dd>
          <dt>Invitations</dt>
          <dd>{{ person.contactOptOut ? 'objected' : 'allowed' }}</dd>
        </dl>
        <div class="detail__actions">
          @if (person.status === 'cancelled') {
            <button type="button" (click)="reinstate(person)">Reinstate</button>
          } @else {
            <button type="button" (click)="cancel(person)">
              Cancel registration
            </button>
          }
          <button type="button" class="danger" (click)="remove(person)">
            Delete permanently
          </button>
        </div>
      </aside>
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

    .meta {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .zone {
      font-size: 0.85rem;
    }

    .chart-section {
      margin-block: 1.5rem;
    }

    .chart {
      inline-size: 100%;
      block-size: 7rem;
      overflow: visible;
    }

    .bar--total {
      fill: color-mix(in oklab, var(--trefaro-color-primary) 25%, transparent);
    }

    .bar--confirmed {
      fill: var(--trefaro-color-primary);
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .swatch {
      display: inline-block;
      inline-size: 0.8rem;
      block-size: 0.8rem;
      border-radius: 0.2rem;
    }

    .swatch--confirmed {
      background: var(--trefaro-color-primary);
    }

    .swatch--total {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 25%,
        transparent
      );
    }

    .controls {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-block-end: 0.8rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    input[type='search'] {
      padding: 0.4rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
      min-inline-size: 16rem;
    }

    .filters {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .chip--on {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 20%,
        transparent
      );
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
    }

    th {
      padding: 0;
    }

    .sort {
      inline-size: 100%;
      padding: 0.5rem 0.6rem;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 600;
      text-align: start;
      cursor: pointer;
    }

    .row--selected {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 8%,
        transparent
      );
    }

    .status {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.85rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
    }

    .status--confirmed {
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

    button[disabled] {
      opacity: 0.5;
      cursor: default;
    }

    .danger {
      border-color: #a3341f;
      color: #a3341f;
    }

    .pager {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-block-start: 0.8rem;
    }

    .detail {
      margin-block-start: 1.5rem;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.6rem;
    }

    .detail header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .detail dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.3rem 1rem;
    }

    .detail dt {
      font-weight: 600;
    }

    .detail__actions {
      display: flex;
      gap: 0.6rem;
      margin-block-start: 1rem;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class ParticipantsPage {
  /** Route parameters, bound by `withComponentInputBinding()`. */
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  /**
   * The view's state, as query parameters.
   *
   * Strings, because that is what a URL carries — the parsing happens below.
   * Declared without a default and read through {@link text}: the router's input
   * binding assigns `undefined` for a parameter that is not in the URL, which
   * overrides any default an `input()` was given. A default here would look like
   * a guarantee it is not.
   */
  readonly search = input<string>();
  readonly status = input<string>();
  readonly sort = input<string>();
  readonly direction = input<string>();
  readonly page = input<string>();
  readonly selected = input<string>();

  protected readonly columns = COLUMNS;
  protected readonly chartWidth = CHART.width;
  protected readonly chartHeight = CHART.height;

  private readonly participants = inject(ParticipantsAdminService);
  private readonly events = inject(EventsAdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly result = signal<ParticipantPage | null>(null);
  protected readonly statistics = signal<RegistrationStatistics | null>(null);
  protected readonly detail = signal<ParticipantDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  /** What is in the box right now — the URL follows after the debounce. */
  protected readonly searchText = signal('');

  /** Bumped after a change, so the page and the graph are read again. */
  private readonly revision = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rows = computed<readonly ParticipantRow[]>(
    () => this.result()?.rows ?? [],
  );

  /** What the search box is filtering by right now, according to the URL. */
  protected readonly searchTerm = computed(() => text(this.search()).trim());

  /** The registration whose detail panel is open, if any. */
  protected readonly selectedId = computed(() => text(this.selected()));

  protected readonly pageNumber = computed(() => {
    const value = Number(text(this.page()));
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
  });

  protected readonly statusFilter = computed<RegistrationStatus | ''>(() => {
    const value = text(this.status());
    return (REGISTRATION_STATUSES as readonly string[]).includes(value)
      ? (value as RegistrationStatus)
      : '';
  });

  protected readonly sortColumn = computed<ParticipantSort>(() => {
    const value = text(this.sort());
    return (PARTICIPANT_SORTS as readonly string[]).includes(value)
      ? (value as ParticipantSort)
      : DEFAULT_PARTICIPANT_SORT;
  });

  protected readonly sortDirection = computed<SortDirection>(() => {
    const value = text(this.direction());
    return value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIRECTION;
  });

  protected readonly pages = computed(() => {
    const result = this.result();
    return result ? pageCount(result.total, result.pageSize) : 1;
  });

  protected readonly statusOptions = computed(() => {
    const counts = this.result()?.counts;
    return [
      { value: '' as const, label: 'All', count: counts?.total ?? 0 },
      {
        value: 'pending' as const,
        label: 'Pending',
        count: counts?.pending ?? 0,
      },
      {
        value: 'confirmed' as const,
        label: 'Confirmed',
        count: counts?.confirmed ?? 0,
      },
      {
        value: 'cancelled' as const,
        label: 'Cancelled',
        count: counts?.cancelled ?? 0,
      },
    ];
  });

  protected readonly matchLabel = computed(() => {
    const result = this.result();
    if (!result) return '';
    const filtered = this.statusFilter() || this.searchTerm();
    // The noun agrees with the number it follows — "1 of 3 registrations", but
    // "1 registration".
    const counted = filtered ? result.counts.total : result.total;
    const noun = counted === 1 ? 'registration' : 'registrations';
    return filtered
      ? `${result.total} of ${result.counts.total} ${noun}`
      : `${result.total} ${noun}`;
  });

  protected readonly emptyMessage = computed(() => {
    if (this.loading()) return 'Loading…';
    if (this.statusFilter() || this.searchTerm()) {
      return 'No registration matches this filter.';
    }
    return 'Nobody has registered for this event yet.';
  });

  /** Bar geometry, scaled to the tallest week. */
  protected readonly bars = computed<readonly Bar[]>(() => {
    const weeks = this.statistics()?.weeks ?? [];
    if (weeks.length === 0) return [];

    const peak = Math.max(...weeks.map((week) => week.total), 1);
    const slot = CHART.width / weeks.length;
    const width = Math.max(1, slot - CHART.gap);

    return weeks.map((week, index) => {
      const totalHeight = (week.total / peak) * CHART.height;
      const confirmedHeight = (week.confirmed / peak) * CHART.height;
      return {
        ...week,
        x: index * slot,
        width,
        totalY: CHART.height - totalHeight,
        totalHeight,
        confirmedY: CHART.height - confirmedHeight,
        confirmedHeight,
      };
    });
  });

  /** What a screen reader is told instead of the bars. */
  protected readonly chartLabel = computed(() => {
    const weeks = this.statistics()?.weeks ?? [];
    if (weeks.length === 0) return 'No registrations yet.';
    const peak = weeks.reduce((highest, week) =>
      week.total > highest.total ? week : highest,
    );
    return (
      `Registrations per week over ${weeks.length} week${weeks.length === 1 ? '' : 's'}, ` +
      `most in the week of ${peak.weekStart} with ${peak.total}.`
    );
  });

  constructor() {
    effect(() => {
      void this.loadEvent(this.eventId());
    });

    effect(() => {
      // Read so that a change to a registration reloads the page as well.
      this.revision();
      // Reads every part of the query, so any change to the URL reloads too.
      void this.loadPage(this.eventId(), this.query());
    });

    effect(() => {
      this.revision();
      void this.loadStatistics(this.eventId());
    });

    effect(() => {
      void this.loadDetail(this.selectedId());
    });

    effect(() => {
      // The box follows the URL when it changes from the outside — the back
      // button, or a link somebody was sent. Not while typing: the value is
      // already what the user typed.
      const fromUrl = text(this.search());
      if (fromUrl !== this.searchText()) this.searchText.set(fromUrl);
    });
  }

  /** In the event's zone, through the one formatter both clients share (E8). */
  protected when(iso: string): string {
    const zone = this.event()?.timezone;
    return zone ? formatInstant(iso, zone) : iso;
  }

  protected ariaSort(
    column: ParticipantSort,
  ): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== column) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortMarker(column: ParticipantSort): string {
    if (this.sortColumn() !== column) return '';
    return this.sortDirection() === 'asc' ? ' ↑' : ' ↓';
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);

    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      // Back to the first page: page 4 of the old result says nothing about the
      // new one.
      this.go({ search: value.trim() || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected filterBy(status: RegistrationStatus | ''): void {
    this.go({ status: status || null, page: null });
  }

  /** A second click on the same column reverses it. */
  protected sortBy(column: ParticipantSort): void {
    const same = this.sortColumn() === column;
    const direction = same && this.sortDirection() === 'asc' ? 'desc' : 'asc';
    this.go({ sort: column, direction, page: null });
  }

  protected goToPage(page: number): void {
    this.go({ page: Math.max(1, page) });
  }

  protected cancel(row: ParticipantRow): void {
    if (
      !confirm(
        `Cancel the registration of ${row.firstName} ${row.lastName}? ` +
          'The entry stays, so the seat is free without losing the record.',
      )
    ) {
      return;
    }
    void this.change(() => this.participants.setStatus(row.id, 'cancelled'));
  }

  /**
   * Puts a cancelled registration back.
   *
   * To `confirmed` if the participant had confirmed their address at some point,
   * otherwise to `pending` — the server refuses anything else, because a
   * confirmation an organizer set by hand would be indistinguishable from a real
   * double opt-in afterwards.
   */
  protected reinstate(row: ParticipantRow): void {
    void this.change(() =>
      this.participants.setStatus(
        row.id,
        row.confirmedAt ? 'confirmed' : 'pending',
      ),
    );
  }

  protected remove(row: ParticipantRow): void {
    if (
      !confirm(
        `Delete the registration of ${row.firstName} ${row.lastName} for good? ` +
          'This cannot be undone.',
      )
    ) {
      return;
    }
    void this.change(async () => {
      await this.participants.remove(row.id);
      this.go({ selected: null });
    });
  }

  private query(): ParticipantQuery {
    return {
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
      sort: this.sortColumn(),
      direction: this.sortDirection(),
      page: this.pageNumber(),
    };
  }

  private go(changes: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }

  private async loadEvent(eventId: string): Promise<void> {
    try {
      this.event.set(await this.events.get(eventId));
    } catch (error: unknown) {
      this.event.set(null);
      this.report(error, 'This event no longer exists.');
    }
  }

  private async loadPage(
    eventId: string,
    query: ParticipantQuery,
  ): Promise<void> {
    this.loading.set(true);
    try {
      this.result.set(await this.participants.list(eventId, query));
      this.error.set(null);
    } catch (error: unknown) {
      this.report(error, 'The participants could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStatistics(eventId: string): Promise<void> {
    try {
      this.statistics.set(await this.participants.statistics(eventId));
    } catch {
      // A missing graph must not hide the table, which is the actual function.
      this.statistics.set(null);
    }
  }

  private async loadDetail(id: string): Promise<void> {
    if (!id) {
      this.detail.set(null);
      return;
    }
    try {
      this.detail.set(await this.participants.get(id));
    } catch (error: unknown) {
      this.detail.set(null);
      this.report(error, 'This registration no longer exists.');
    }
  }

  private async change(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      this.revision.update((value) => value + 1);
      if (this.selectedId()) await this.loadDetail(this.selectedId());
    } catch (error: unknown) {
      this.report(error, 'The change could not be saved.');
    }
  }

  private report(error: unknown, fallback: string): void {
    this.error.set((error as ApiError)?.message ?? fallback);
  }
}

/**
 * A query parameter as a string, whether it is there or not.
 *
 * The router binds a missing parameter as `undefined`, so every read goes
 * through this rather than trusting an `input()` default.
 */
function text(value: string | undefined): string {
  return value ?? '';
}
