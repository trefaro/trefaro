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
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  AttachmentSummary,
  OrganizerEvent,
  ParticipantDetail,
  ParticipantPage,
  ParticipantQuery,
  ParticipantRow,
  ParticipantSort,
  RegistrationField,
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
  formatAnswer,
  formatBytes,
  formatInstant,
  pageCount,
  registrationStatusKey,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { AttachmentsAdminService } from '../../features/registrations/attachments-admin.service';
import { ParticipantsAdminService } from '../../features/registrations/participants-admin.service';
import { RegistrationFieldsAdminService } from '../../features/registrations/registration-fields-admin.service';

/** Long enough to finish typing a name, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 300;

/** Geometry of the weekly graph, in SVG user units. */
const CHART = { width: 720, height: 120, gap: 2 } as const;

interface Column {
  readonly key: ParticipantSort;
  readonly labelKey: string;
}

const COLUMNS: readonly Column[] = [
  { key: 'name', labelKey: 'admin.participants.colName' },
  { key: 'email', labelKey: 'admin.participants.colEmail' },
  { key: 'status', labelKey: 'admin.participants.colStatus' },
  { key: 'registeredAt', labelKey: 'admin.participants.colRegistered' },
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

    <header class="head">
      <div>
        <h1>{{ 'admin.participants.title' | transloco }}</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
            <span class="zone">
              {{
                'admin.participants.timesIn'
                  | transloco: { zone: item.timezone }
              }}
            </span>
          }
        </p>
      </div>
      <a class="back" [routerLink]="['/series', seriesId()]">
        {{ 'admin.dashboard.backToSeries' | transloco }}
      </a>
    </header>

    @if (statistics(); as figures) {
      <section class="chart-section">
        <h2>{{ 'admin.participants.perWeek' | transloco }}</h2>
        @if (bars().length === 0) {
          <p class="meta">
            {{ 'admin.dashboard.metaNobody' | transloco }}
          </p>
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
                  {{
                    'admin.participants.barTitle'
                      | transloco
                        : {
                            week: bar.weekStart,
                            total: bar.total,
                            confirmed: bar.confirmed,
                          }
                  }}
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
            <span class="swatch swatch--confirmed"></span>
            {{ 'registration.status.confirmed' | transloco }}
            <span class="swatch swatch--total"></span>
            {{ 'admin.participants.legendRegistered' | transloco }}
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
          <label for="participant-search">
            {{ 'admin.participants.search' | transloco }}
          </label>
          <input
            id="participant-search"
            type="search"
            autocomplete="off"
            [placeholder]="'admin.participants.searchPlaceholder' | transloco"
            [value]="searchText()"
            (input)="onSearch($event)"
          />
        </div>

        <div
          class="filters"
          role="group"
          [attr.aria-label]="'admin.participants.filterGroup' | transloco"
        >
          @for (option of statusOptions(); track option.value) {
            <button
              type="button"
              class="chip"
              [class.chip--on]="option.value === statusFilter()"
              [attr.aria-pressed]="option.value === statusFilter()"
              (click)="filterBy(option.value)"
            >
              {{ option.labelKey | transloco }} ({{ option.count }})
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
                  {{ column.labelKey | transloco }}{{ sortMarker(column.key) }}
                </button>
              </th>
            }
            <th>{{ 'admin.participants.colNewsletter' | transloco }}</th>
            <!-- Not sortable: the flag is not a column of the registration
                 table but an EXISTS over the address (E31), and a sort key the
                 server does not offer would be a header that lies when
                 clicked. -->
            <th>{{ 'admin.participants.colProfile' | transloco }}</th>
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
                  {{ statusKey(row.status) | transloco }}
                </span>
              </td>
              <td>{{ when(row.registeredAt) }}</td>
              <td>
                @if (row.newsletterOptIn) {
                  {{ 'admin.participants.yes' | transloco }}
                } @else {
                  —
                }
              </td>
              <td>
                @if (row.hasProfile) {
                  {{ 'admin.participants.yes' | transloco }}
                } @else {
                  —
                }
              </td>
              <td class="actions">
                @if (row.status === 'cancelled') {
                  <button type="button" (click)="reinstate(row)">
                    {{ 'admin.participants.reinstate' | transloco }}
                  </button>
                } @else {
                  <button type="button" (click)="cancel(row)">
                    {{ 'admin.participants.cancel' | transloco }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="meta">
                {{ emptyMessageKey() | transloco }}
              </td>
            </tr>
          }
        </tbody>
      </table>

      <nav
        class="pager"
        [attr.aria-label]="'admin.participants.pages' | transloco"
      >
        <button
          type="button"
          [disabled]="pageNumber() <= 1"
          (click)="goToPage(pageNumber() - 1)"
        >
          {{ 'admin.common.previous' | transloco }}
        </button>
        <span>
          {{
            'admin.participants.pageOf'
              | transloco: { page: pageNumber(), pages: pages() }
          }}
        </span>
        <button
          type="button"
          [disabled]="pageNumber() >= pages()"
          (click)="goToPage(pageNumber() + 1)"
        >
          {{ 'admin.common.next' | transloco }}
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
            {{ 'admin.participants.close' | transloco }}
          </a>
        </header>
        <dl>
          <dt>{{ 'admin.participants.colEmail' | transloco }}</dt>
          <dd>
            <a [href]="'mailto:' + person.email">{{ person.email }}</a>
          </dd>
          <dt>{{ 'admin.participants.phone' | transloco }}</dt>
          <dd>{{ person.phone ?? '—' }}</dd>
          <dt>{{ 'admin.participants.origin' | transloco }}</dt>
          <dd>{{ person.origin ?? '—' }}</dd>
          <dt>{{ 'admin.participants.colStatus' | transloco }}</dt>
          <dd>{{ statusKey(person.status) | transloco }}</dd>
          <dt>{{ 'admin.participants.colRegistered' | transloco }}</dt>
          <dd>{{ when(person.registeredAt) }}</dd>
          <dt>{{ 'admin.participants.confirmedAt' | transloco }}</dt>
          <dd>
            @if (person.confirmedAt; as at) {
              {{ when(at) }}
            } @else {
              {{ 'admin.participants.notYet' | transloco }}
            }
          </dd>
          <dt>{{ 'admin.participants.colNewsletter' | transloco }}</dt>
          <dd>
            {{
              (person.newsletterOptIn
                ? 'admin.participants.yes'
                : 'admin.participants.no'
              ) | transloco
            }}
          </dd>
          <dt>{{ 'admin.participants.colProfile' | transloco }}</dt>
          <dd>
            {{
              (person.hasProfile
                ? 'admin.participants.yes'
                : 'admin.participants.no'
              ) | transloco
            }}
          </dd>
          <dt>{{ 'admin.participants.invitations' | transloco }}</dt>
          <dd>
            {{
              (person.contactOptOut
                ? 'admin.participants.objected'
                : 'admin.participants.allowed'
              ) | transloco
            }}
          </dd>
        </dl>

        @if (answers().length > 0) {
          <h3>{{ 'admin.participants.answers' | transloco }}</h3>
          <dl>
            @for (answer of answers(); track answer.label) {
              <dt>{{ answer.label }}</dt>
              <dd>{{ answer.value }}</dd>
            }
          </dl>
        }

        @if (documents().length > 0) {
          <h3>{{ 'admin.participants.files' | transloco }}</h3>
          <ul class="files">
            @for (document of documents(); track document.key) {
              <li>
                <span class="files__label">{{ document.label }}</span>
                @if (document.file; as file) {
                  <button
                    type="button"
                    class="link"
                    [disabled]="downloading() === file.id"
                    (click)="download(file)"
                  >
                    {{ file.fileName }}
                  </button>
                  <span class="meta">{{ size(file) }}</span>
                } @else {
                  <span class="meta">
                    {{ 'admin.participants.nothingUploaded' | transloco }}
                  </span>
                }
              </li>
            }
          </ul>
        }

        @if (leftovers().length > 0) {
          <h3>{{ 'admin.participants.leftovers' | transloco }}</h3>
          <dl>
            @for (answer of leftovers(); track answer.key) {
              <dt>
                <code>{{ answer.key }}</code>
              </dt>
              <dd>{{ answer.value }}</dd>
            }
          </dl>
          <p class="meta">
            {{ 'admin.participants.leftoversHint' | transloco }}
          </p>
        }
        <div class="detail__actions">
          @if (person.status === 'cancelled') {
            <button type="button" (click)="reinstate(person)">
              {{ 'admin.participants.reinstate' | transloco }}
            </button>
          } @else {
            <button type="button" (click)="cancel(person)">
              {{ 'admin.participants.cancelRegistration' | transloco }}
            </button>
          }
          <button type="button" class="danger" (click)="remove(person)">
            {{ 'admin.participants.deletePermanently' | transloco }}
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

    .detail h3 {
      margin-block: 1rem 0.4rem;
      font-size: 1rem;
    }

    .detail code {
      font-size: 0.9rem;
    }

    .files {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .files li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
    }

    .files__label {
      font-weight: 600;
    }

    /* A download is a request, not a navigation — but it should read as a link. */
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: var(--trefaro-color-primary-strong);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }

    .link:disabled {
      opacity: 0.55;
      cursor: default;
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
  private readonly registrationFields = inject(RegistrationFieldsAdminService);
  private readonly attachments = inject(AttachmentsAdminService);
  private readonly events = inject(EventsAdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslationService);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly result = signal<ParticipantPage | null>(null);
  protected readonly statistics = signal<RegistrationStatistics | null>(null);
  protected readonly detail = signal<ParticipantDetail | null>(null);
  /** The event's configurable questions (F12) — what the answers are labelled by. */
  protected readonly fields = signal<readonly RegistrationField[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly statusKey = registrationStatusKey;
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

  /** The attachment currently being fetched, so its button can say so. */
  protected readonly downloading = signal<string | null>(null);

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

  /**
   * The filter chips — keys, not words.
   *
   * A memoised value that held finished text would keep the language the page
   * was opened in (F72); handing the template a key lets its pipe do both the
   * lookup and the repaint.
   */
  protected readonly statusOptions = computed(() => {
    const counts = this.result()?.counts;
    return [
      {
        value: '' as const,
        labelKey: 'admin.participants.filter.all',
        count: counts?.total ?? 0,
      },
      {
        value: 'pending' as const,
        labelKey: 'admin.participants.filter.pending',
        count: counts?.pending ?? 0,
      },
      {
        value: 'confirmed' as const,
        labelKey: 'admin.participants.filter.confirmed',
        count: counts?.confirmed ?? 0,
      },
      {
        value: 'cancelled' as const,
        labelKey: 'admin.participants.filter.cancelled',
        count: counts?.cancelled ?? 0,
      },
    ];
  });

  /** Built here, so it reads the language itself (F72). */
  protected readonly matchLabel = computed(() => {
    this.i18n.locale();
    const result = this.result();
    if (!result) return '';
    const filtered = this.statusFilter() || this.searchTerm();
    // The noun agrees with the number it follows — "1 of 3 registrations", but
    // "1 registration".
    const counted = filtered ? result.counts.total : result.total;
    const plural = counted === 1 ? 'one' : 'many';
    return this.i18n.translate(
      filtered
        ? `admin.participants.matchFiltered.${plural}`
        : `admin.participants.matchAll.${plural}`,
      { shown: result.total, total: result.counts.total },
    );
  });

  protected readonly emptyMessageKey = computed(() => {
    if (this.loading()) return 'common.loading';
    if (this.statusFilter() || this.searchTerm()) {
      return 'admin.participants.noMatch';
    }
    return 'admin.dashboard.empty';
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

  /**
   * The open registration's answers to the questions this event asks (F12).
   *
   * Every defined field, answered or not: an empty answer to a question the
   * organizer asked is information too, and a field that silently disappears
   * from the panel looks like it was never asked.
   */
  protected readonly answers = computed(() => {
    const person = this.detail();
    if (!person) return [];
    return (
      this.fields()
        // A file field is not answered with a value (F37); it appears under
        // "Files", with the name of what was uploaded.
        .filter((field) => field.type !== 'file')
        .map((field) => ({
          label: field.label,
          value: formatAnswer(person.customFields[field.key]),
        }))
    );
  });

  /**
   * The files this registration was asked for, and what arrived (E9).
   *
   * Every file field is listed, answered or not — an organizer chasing a missing
   * visa document needs to see that it is missing. A file whose question was
   * deleted since is listed too, under its bare key: deleting the question does
   * not delete the answer (F34), and a document least of all.
   */
  protected readonly documents = computed(() => {
    const person = this.detail();
    if (!person) return [];

    const uploaded = new Map(
      person.attachments.map((attachment) => [attachment.fieldKey, attachment]),
    );
    const asked = this.fields().filter((field) => field.type === 'file');
    const askedKeys = new Set(asked.map((field) => field.key));

    return [
      ...asked.map((field) => ({
        key: field.key,
        label: field.label,
        file: uploaded.get(field.key) ?? null,
      })),
      ...person.attachments
        .filter((attachment) => !askedKeys.has(attachment.fieldKey))
        .map((attachment) => ({
          key: attachment.fieldKey,
          label: attachment.fieldKey,
          file: attachment,
        })),
    ];
  });

  /**
   * Answers to questions the form no longer asks (F34).
   *
   * Deleting a definition does not delete what people wrote, so these are shown
   * under their bare key rather than dropped — the organizer removed the
   * question, not the answers.
   */
  protected readonly leftovers = computed(() => {
    const person = this.detail();
    if (!person) return [];
    const known = new Set(this.fields().map((field) => field.key));
    return Object.entries(person.customFields)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => ({ key, value: formatAnswer(value) }));
  });

  protected size(file: AttachmentSummary): string {
    return formatBytes(file.sizeBytes, this.i18n.locale());
  }

  /**
   * Fetches one uploaded file and hands it to the browser (E9).
   *
   * A button rather than a link: the bytes only come with an administrative
   * session, and the volume has no public URL to link to at all.
   */
  protected async download(file: AttachmentSummary): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(file.id);
    try {
      await this.attachments.save(file);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.participants.errorDownload'));
    } finally {
      this.downloading.set(null);
    }
  }

  /** What a screen reader is told instead of the bars. */
  protected readonly chartLabel = computed(() => {
    this.i18n.locale();
    const weeks = this.statistics()?.weeks ?? [];
    if (weeks.length === 0) {
      return this.i18n.translate('admin.participants.chartEmpty');
    }
    const peak = weeks.reduce((highest, week) =>
      week.total > highest.total ? week : highest,
    );
    return this.i18n.translate(
      weeks.length === 1
        ? 'admin.participants.chartLabel.one'
        : 'admin.participants.chartLabel.many',
      { weeks: weeks.length, peak: peak.weekStart, count: peak.total },
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
      void this.loadFields(this.eventId());
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
    return zone ? formatInstant(iso, zone, this.i18n.locale()) : iso;
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
    const question = this.i18n.translate('admin.participants.confirmCancel', {
      name: `${row.firstName} ${row.lastName}`,
    });
    if (!confirm(question)) {
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
    const question = this.i18n.translate('admin.participants.confirmDelete', {
      name: `${row.firstName} ${row.lastName}`,
    });
    if (!confirm(question)) {
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
      this.report(error, 'admin.events.errorMissing');
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
      this.report(error, 'admin.participants.errorLoad');
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

  private async loadFields(eventId: string): Promise<void> {
    try {
      this.fields.set(await this.registrationFields.list(eventId));
    } catch {
      // The table is the function of this page; unlabelled answers are a worse
      // outcome than none, and the leftover block still shows them by key.
      this.fields.set([]);
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
      this.report(error, 'admin.participants.errorMissing');
    }
  }

  private async change(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      this.revision.update((value) => value + 1);
      if (this.selectedId()) await this.loadDetail(this.selectedId());
    } catch (error: unknown) {
      this.report(error, 'admin.fields.errorSave');
    }
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
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
