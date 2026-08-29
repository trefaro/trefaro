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
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  EventDashboard,
  MediaLinkSummary,
  OrganizerEvent,
} from '@trefaro/shared-models';
import {
  eventStatusKey,
  formatEventPeriod,
  formatInstant,
  mediaLinkKindKey,
  publicEventPath,
  registrationStatusKey,
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
 * 2. **No tile for a module that does not exist yet — or is switched off.** The
 *    mockup's tiles for new messages (phase 3) and for programme proposals and
 *    the forum (phase 4) are absent rather than showing a hard zero: a zero is a
 *    claim about data, and a dashboard full of zeros teaches an organizer to
 *    stop reading it. The same holds for the media links tile, which the server
 *    omits when the organization has switched the module off (FR 1.5, F53): a
 *    tile leading to endpoints that answer 404 would be a dead end drawn as a
 *    feature. The grid reflows either way.
 * 3. **The e-mail address is in the table.** Same rule as in the participant
 *    overview (E13) — the next thing an organizer does after seeing a new
 *    registration is write to the person.
 * 4. **The public address is shown, not linked.** The participant client is a
 *    different origin, and this client is not told which one (that arrives with
 *    the configuration work of phase 2). A link that works in production and
 *    404s in development would be worse than the address itself.
 *
 * The lines under the numbers are assembled here rather than in the template,
 * so each is a method that reads the catalogue — and a method, not a
 * `computed()`, because the pipes on this page mark the view when the language
 * changes and a memoised value would keep the old words (F72).
 */
@Component({
  selector: 'trefaro-event-dashboard-page',
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

    @if (dashboard(); as view) {
      <header class="head">
        <div>
          <h1>{{ view.event.name }}</h1>
          <p class="meta">
            <span class="status" [class]="'status--' + view.event.status">
              {{ statusKey(view.event.status) | transloco }}
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
            {{ 'admin.events.edit' | transloco }}
          </a>
          @if (view.event.status === 'published') {
            <button type="button" (click)="setStatus('draft')">
              {{ 'admin.series.unpublish' | transloco }}
            </button>
          } @else {
            <button type="button" (click)="setStatus('published')">
              {{ 'admin.series.publish' | transloco }}
            </button>
          }
          <a
            [routerLink]="[
              '/series',
              seriesId(),
              'events',
              eventId(),
              'translations',
            ]"
          >
            {{ 'admin.translations.link' | transloco }}
          </a>
          <a [routerLink]="['/series', seriesId()]">
            {{ 'admin.dashboard.backToSeries' | transloco }}
          </a>
        </div>
      </header>

      <section
        class="tiles"
        [attr.aria-label]="'admin.dashboard.summary' | transloco"
      >
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
              {{ 'admin.participants.title' | transloco }}
            </a>
          </h2>
          <!-- Number and unit are drawn at two sizes, so the unit is a key of
               its own rather than part of a sentence. -->
          <p class="tile__value">
            {{ view.registrations.confirmed }}
            <span class="tile__unit">
              {{ 'registration.status.confirmed' | transloco }}
            </span>
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
              {{ 'admin.program.title' | transloco }}
            </a>
          </h2>
          <p class="tile__value">
            {{ view.program.items }}
            <span class="tile__unit">
              {{
                (view.program.items === 1
                  ? 'admin.dashboard.sessions.one'
                  : 'admin.dashboard.sessions.many'
                ) | transloco
              }}
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
              {{ 'admin.fields.title' | transloco }}
            </a>
          </h2>
          <p class="tile__value">
            {{ view.form.questions }}
            <span class="tile__unit">
              {{
                (view.form.questions === 1
                  ? 'admin.dashboard.questions.one'
                  : 'admin.dashboard.questions.many'
                ) | transloco
              }}
            </span>
          </p>
          <p class="tile__meta">{{ formMeta() }}</p>
        </article>
        @if (view.mediaLinks; as media) {
          <article class="tile">
            <h2>
              <a
                [routerLink]="[
                  '/series',
                  seriesId(),
                  'events',
                  eventId(),
                  'media-links',
                ]"
              >
                {{ 'modules.mediaLinks.title' | transloco }}
              </a>
            </h2>
            <p class="tile__value">
              {{ media.links }}
              <span class="tile__unit">
                {{
                  (media.links === 1
                    ? 'admin.dashboard.links.one'
                    : 'admin.dashboard.links.many'
                  ) | transloco
                }}
              </span>
            </p>
            <p class="tile__meta">{{ mediaMeta(media) }}</p>
          </article>
        }
        <!-- The tiles for messages (phase 3) and for the proposal and forum
             plug-ins (phase 4) appear here. Deliberately not present as zeros
             while the modules do not exist. -->
      </section>

      <section>
        <div class="section-head">
          <h2>{{ 'admin.dashboard.latest' | transloco }}</h2>
          <a
            [routerLink]="[
              '/series',
              seriesId(),
              'events',
              eventId(),
              'participants',
            ]"
          >
            {{ 'admin.dashboard.allParticipants' | transloco }}
          </a>
        </div>

        @if (latest().length === 0) {
          <p class="meta">
            {{
              (loading() ? 'common.loading' : 'admin.dashboard.empty')
                | transloco
            }}
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>{{ 'admin.dashboard.name' | transloco }}</th>
                <!-- In the table, not behind a click (E13). -->
                <th>{{ 'admin.dashboard.email' | transloco }}</th>
                <th>{{ 'admin.dashboard.status' | transloco }}</th>
                <th>{{ 'admin.dashboard.registered' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of latest(); track row.id) {
                <tr>
                  <td>{{ row.lastName }}, {{ row.firstName }}</td>
                  <td>{{ row.email }}</td>
                  <td>
                    <span class="status" [class]="'status--' + row.status">
                      {{ registrationStatusKey(row.status) | transloco }}
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
      <p class="meta">{{ 'common.loading' | transloco }}</p>
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
  private readonly i18n = inject(TranslationService);

  protected readonly dashboard = signal<EventDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<Problem | null>(null);
  protected readonly statusKey = eventStatusKey;
  protected readonly registrationStatusKey = registrationStatusKey;

  protected readonly event = computed(() => this.dashboard()?.event ?? null);
  protected readonly latest = computed(
    () => this.dashboard()?.latestRegistrations ?? [],
  );

  constructor() {
    effect(() => {
      void this.load(this.eventId());
    });
  }

  /**
   * The period in the event's own zone, never the browser's (E8) — spelled out
   * in the reader's language, which is a different question (F78).
   */
  protected when(): string {
    const event = this.event();
    return event ? formatEventPeriod(event, this.i18n.locale()) : '';
  }

  protected address(): string {
    const view = this.dashboard();
    return view ? publicEventPath(view.seriesSlug, view.event.slug) : '';
  }

  protected registeredAt(iso: string): string {
    const zone = this.event()?.timezone;
    return zone ? formatInstant(iso, zone, this.i18n.locale()) : iso;
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
    if (counts.total === 0) return this.say('admin.dashboard.metaNobody');

    const parts: string[] = [];
    if (counts.pending > 0) {
      parts.push(this.say('admin.dashboard.metaPending', counts.pending));
    }
    if (counts.cancelled > 0) {
      parts.push(this.say('admin.dashboard.metaCancelled', counts.cancelled));
    }
    return parts.length > 0
      ? parts.join(' · ')
      : this.say('admin.dashboard.metaAllConfirmed');
  }

  /**
   * Two counts in one sentence, so one key per combination.
   *
   * Transloco carries no plural rules of its own here, and the alternative —
   * "3 seats taken" plus "in 2 sessions" as two fragments — is what F79 rules
   * out: a translator cannot reorder what arrives already glued. Four keys is
   * the honest price of a sentence that counts twice.
   */
  protected programMeta(): string {
    const program = this.dashboard()?.program;
    if (!program) return '';
    if (program.items === 0) return this.say('admin.dashboard.metaNoProgram');
    if (program.withSignup === 0) {
      return this.say('admin.dashboard.metaNoSignup');
    }

    const seats = program.signups === 1 ? 'one' : 'many';
    const sessions = program.withSignup === 1 ? 'One' : 'Many';
    return this.i18n.translate(
      `admin.dashboard.metaSeats.${seats}${sessions}`,
      {
        seats: program.signups,
        sessions: program.withSignup,
      },
    );
  }

  /**
   * What the media tile says under its number (FR 3.6).
   *
   * The kinds that have something, named — "1 stream · 2 recordings" tells an
   * organizer what is missing before an event and what arrived after it. A tally
   * of three zeros would not.
   */
  protected mediaMeta(media: MediaLinkSummary): string {
    if (media.links === 0) return this.say('admin.dashboard.metaNoMedia');

    const parts: string[] = [];
    // The kinds are named once, in `shared-models`, and counted here: a second
    // set of words for "recording" would be a second thing to keep in step.
    for (const [kind, count] of [
      ['stream', media.streams],
      ['recording', media.recordings],
      ['material', media.materials],
    ] as const) {
      if (count > 0) {
        parts.push(
          this.i18n.translate('admin.dashboard.metaCount', {
            count,
            label: this.i18n.translate(mediaLinkKindKey(kind, count)),
          }),
        );
      }
    }
    return parts.join(' · ');
  }

  protected formMeta(): string {
    const form = this.dashboard()?.form;
    if (!form) return '';
    if (form.questions === 0) {
      return this.say('admin.dashboard.metaStandardFields');
    }
    return form.required === 0
      ? this.say('admin.dashboard.metaNoneRequired')
      : this.say('admin.dashboard.metaRequired', form.required);
  }

  /** One counted line of a tile, in the reader's language. */
  private say(key: string, count?: number): string {
    return this.i18n.translate(
      key,
      count === undefined ? undefined : { count },
    );
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
          ? { key: 'admin.events.errorMissing', detail: null }
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
