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
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  MediaLinkGroup,
  ProgramDay,
  PublicEvent,
  PublicMediaLink,
  PublicProgramItem,
} from '@trefaro/shared-models';
import {
  MEDIA_LINKS_MODULE_KEY,
  eventMediaLinks,
  formatEventPeriod,
  formatProgramTime,
  groupMediaLinksByKind,
  groupProgramByDay,
  hasEnded,
  isProgramItemFull,
  programItemMediaLinks,
  seatsLeft,
} from '@trefaro/shared-models';
import { PluginSlot } from '@trefaro/shared-plugins';
import { EventDetailTiles } from './event-detail-tiles';
import { PublicEventsService } from '../../features/events/public-events.service';
import { PublicMediaLinksService } from '../../features/media-links/public-media-links.service';
import { PublicProgramService } from '../../features/program/public-program.service';

/**
 * The public event landing page (FR 3.6) — the highest-rated participant
 * feature of the survey (3,74).
 *
 * Reachable without a login and without a registration: this is the page a
 * shared link points at, and someone who has never heard of the organization
 * has to be able to judge from it whether to come. Hence the order: what it is,
 * when, where, in which language, and only then the call to action.
 *
 * Times are rendered in the event's own zone, never the reader's (E8), and the
 * zone is named — a participant three time zones away must not have to guess
 * whose 09:00 this is. That holds for the programme below as much as for the
 * event itself: the timeline groups sessions into the days they fall on *at the
 * venue*, and each day heading names the zone once.
 *
 * The programme is fetched separately from the event (FR 3.7). What the page
 * has to answer first is "what is this, when, where" — a conference with two
 * hundred sessions must not delay that.
 *
 * Sessions with a seat limit say how many are left (FR 3.10) but are not claimed
 * here: claiming one needs a registration, and the page for it opens from the
 * personal link in the confirmation mail (E11).
 *
 * Two things arrive with AP 11, and both are the second half of FR 3.6 — what an
 * event leaves behind:
 *
 * - **The follow-up section**, once the event has ended. The page does not decide
 *   that: the server withholds the text until then (F50), so what is not on the
 *   page is not in the payload either.
 * - **Media links.** Streams, recordings and material somebody else hosts,
 *   rendered as links and never embedded — an `<iframe>` would load a third
 *   party's code, in practice Google's, into a page that promises not to (NFR 9,
 *   F51). `rel="noopener noreferrer"` for the same reason: following a link does
 *   not tell the other side which instance sent the visitor. A link that belongs
 *   to one session is shown with that session rather than in a list of forty.
 *
 * Carries the second plug-in hook point: the programme, the room plan and the
 * forum mount here as web components once their modules are enabled.
 *
 * Since AP 4 of phase 2 it also carries the tiles the mockups draw
 * ({@link EventDetailTiles}) — one per part of this page that actually has
 * something in it, including one per mounted plug-in. They are jump links: this
 * page *is* the event detail view, so a tile leads to a section of it rather than
 * to a second rendering somewhere else.
 */
@Component({
  selector: 'trefaro-event-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PluginSlot, EventDetailTiles, TranslocoPipe],
  template: `
    @if (error(); as problem) {
      <p class="notice" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="notice__detail">{{ detail }}</span>
        }
      </p>
      <p>
        <a routerLink="/">{{ 'event.backToSeriesList' | transloco }}</a>
      </p>
    } @else if (event(); as item) {
      <article>
        <header class="head">
          @if (item.logoUrl) {
            <img class="head__logo" [src]="item.logoUrl" alt="" />
          }
          <div>
            <h1>{{ item.name }}</h1>
            @if (isOver()) {
              <p class="over">{{ 'event.hasEnded' | transloco }}</p>
            }
          </div>
        </header>

        <dl class="facts">
          <dt>{{ 'event.when' | transloco }}</dt>
          <dd>{{ when() }}</dd>

          <dt>{{ 'event.format' | transloco }}</dt>
          <dd>{{ format() }}</dd>

          @if (item.venueName) {
            <dt>{{ 'event.where' | transloco }}</dt>
            <dd>
              {{ item.venueName }}
              @if (item.venueAddress) {
                <span class="address">{{ item.venueAddress }}</span>
              }
            </dd>
          }
          @if (item.onlineUrl) {
            <dt>{{ 'event.online' | transloco }}</dt>
            <dd>
              <a [href]="item.onlineUrl" rel="noopener noreferrer">
                {{ item.onlineUrl }}
              </a>
            </dd>
          }

          <dt>
            {{
              (item.languages.length === 1
                ? 'event.language.one'
                : 'event.language.many'
              ) | transloco
            }}
          </dt>
          <dd>{{ item.languages.join(', ') }}</dd>
        </dl>

        <p class="description">{{ item.description }}</p>

        <!-- What this event offers, as jump links to the sections below
             (mockups 5.2). Nothing here navigates: a plug-in at the event detail
             hook point renders further down this page. -->
        <trefaro-event-detail-tiles
          [sessions]="items().length"
          [mediaLinks]="mediaLinkCount()"
        />

        @if (item.followUpBody) {
          <section class="follow-up" aria-labelledby="follow-up-heading">
            <h2 id="follow-up-heading">
              {{ 'event.followUp' | transloco }}
            </h2>
            <p class="follow-up__text">{{ item.followUpBody }}</p>
          </section>
        }

        @if (media().length > 0) {
          <section id="media" class="media" aria-labelledby="media-heading">
            <h2 id="media-heading">{{ 'event.media' | transloco }}</h2>
            @for (group of media(); track group.kind) {
              <h3 class="media__kind">{{ group.labelKey | transloco }}</h3>
              <ul class="media__links">
                @for (link of group.links; track link.id) {
                  <li>
                    <a
                      [href]="link.url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ link.title }}
                    </a>
                  </li>
                }
              </ul>
            }
          </section>
        }

        @if (days().length > 0) {
          <section
            id="program"
            class="program"
            aria-labelledby="program-heading"
          >
            <h2 id="program-heading">{{ 'event.program' | transloco }}</h2>
            @if (hasSignups()) {
              <p class="program__note">
                {{ 'event.programSeats' | transloco }}
              </p>
            }
            @for (day of days(); track day.key) {
              <h3 class="program__day">{{ day.label }}</h3>
              <ol class="program__items">
                <!-- Named session, not item: the event is already bound to
                     item above, and shadowing it here would be a trap. -->
                @for (session of day.items; track session.id) {
                  <li class="session">
                    <p class="session__clock">{{ clock(session) }}</p>
                    <div>
                      <h4 class="session__title">{{ session.title }}</h4>
                      @if (session.speaker) {
                        <p class="session__speaker">{{ session.speaker }}</p>
                      }
                      @if (session.description) {
                        <p class="session__text">{{ session.description }}</p>
                      }
                      @if (session.registrationEnabled) {
                        <p class="session__seats">{{ seats(session) }}</p>
                      }
                      @if (sessionLinks(session).length > 0) {
                        <ul class="session__links">
                          @for (link of sessionLinks(session); track link.id) {
                            <li>
                              <a
                                [href]="link.url"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {{ link.title }}
                              </a>
                            </li>
                          }
                        </ul>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </section>
        }

        @if (!isOver()) {
          <p class="cta">
            <a
              class="cta__button"
              [routerLink]="[
                '/series',
                seriesSlug(),
                'events',
                eventSlug(),
                'register',
              ]"
            >
              {{ 'event.register' | transloco }}
            </a>
            <small>{{ 'event.registerHint' | transloco }}</small>
          </p>
        }

        <!-- Plug-in hook point two: the event detail view. Each plug-in gets the
             event as element properties. -->
        <trefaro-plugin-slot
          mountPoint="event-detail"
          [context]="pluginContext()"
        />

        <p>
          <a [routerLink]="['/series', seriesSlug()]">
            {{ 'event.allOfSeries' | transloco }}
          </a>
        </p>
      </article>
    } @else {
      <p class="notice">{{ 'common.loading' | transloco }}</p>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .head__logo {
      inline-size: 3.5rem;
      block-size: 3.5rem;
      object-fit: contain;
    }

    .over {
      margin: 0;
      color: color-mix(in oklab, currentColor 65%, transparent);
    }

    .facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.35rem 0.9rem;
      max-inline-size: 40rem;
      margin-block: 1.25rem;
    }

    .facts dt {
      font-weight: 600;
    }

    .facts dd {
      margin: 0;
    }

    .address {
      display: block;
      white-space: pre-line;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .description {
      max-inline-size: 40rem;
      white-space: pre-line;
    }

    .follow-up,
    .media {
      max-inline-size: 40rem;
      margin-block: 1.75rem;
    }

    .follow-up h2,
    .media h2 {
      font-size: 1.1rem;
    }

    .follow-up__text {
      white-space: pre-line;
    }

    .media__kind {
      margin-block: 1rem 0.35rem;
      font-size: 0.95rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .media__links,
    .session__links {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .session__links {
      margin-block-start: 0.35rem;
      font-size: 0.9rem;
    }

    .program {
      max-inline-size: 40rem;
      margin-block: 1.75rem;
    }

    .program__day {
      margin-block: 1.25rem 0.5rem;
      font-size: 1rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .program__items {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* Mobile-first: the clock sits above the session and moves beside it as
       soon as there is room for a column of times. */
    .session {
      display: grid;
      gap: 0.15rem 0.9rem;
      padding-inline-start: 0.75rem;
      border-inline-start: 2px solid
        color-mix(in oklab, var(--trefaro-color-accent) 60%, transparent);
    }

    @media (min-width: 30rem) {
      .session {
        grid-template-columns: 7.5rem 1fr;
      }
    }

    .session__clock {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .session__title {
      margin: 0;
      font-size: 1rem;
    }

    .session__speaker {
      margin: 0.1rem 0 0;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .session__text {
      margin: 0.35rem 0 0;
      white-space: pre-line;
    }

    .session__seats {
      margin: 0.35rem 0 0;
      font-weight: 600;
    }

    .program__note {
      margin-block: 0 1rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .cta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: start;
      margin-block: 1.5rem;
    }

    .cta__button {
      padding: 0.6rem 1.1rem;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
      text-decoration: none;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class EventLandingPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesSlug = input.required<string>();
  readonly eventSlug = input.required<string>();

  private readonly events = inject(PublicEventsService);
  private readonly program = inject(PublicProgramService);
  private readonly mediaLinks = inject(PublicMediaLinksService);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);

  protected readonly event = signal<PublicEvent | null>(null);
  protected readonly items = signal<readonly PublicProgramItem[]>([]);
  protected readonly links = signal<readonly PublicMediaLink[]>([]);
  protected readonly error = signal<Problem | null>(null);

  protected readonly isOver = computed(() => {
    const event = this.event();
    return event ? hasEnded(event) : false;
  });

  /**
   * The programme grouped into days as they are counted at the venue (E8).
   *
   * Empty until the event is known: the zone the days are counted in comes from
   * the event, and grouping in the reader's zone first would move a session
   * across midnight and then move it back.
   */
  protected readonly days = computed<readonly ProgramDay[]>(() => {
    const event = this.event();
    return event
      ? groupProgramByDay(this.items(), event.timezone, this.i18n.locale())
      : [];
  });

  /** Whether any session asks who is coming — the note above the timeline. */
  protected readonly hasSignups = computed(() =>
    this.items().some((item) => item.registrationEnabled),
  );

  /**
   * The event's own media links, in sections (FR 3.6).
   *
   * Only the ones that belong to the event as a whole: a link on a session is
   * rendered with that session, which is where somebody looking for the
   * recording of one talk looks for it.
   */
  protected readonly media = computed<
    readonly MediaLinkGroup<PublicMediaLink>[]
  >(() => groupMediaLinksByKind(eventMediaLinks(this.links())));

  /**
   * How many links the media section renders — the number its tile carries.
   *
   * The event's own links, not every link: one that belongs to a session is
   * shown with that session, and a tile pointing at the media section must not
   * promise links that are not in it.
   */
  protected readonly mediaLinkCount = computed(() =>
    this.media().reduce((total, group) => total + group.links.length, 0),
  );

  /**
   * What a mounted plug-in is told about this page.
   *
   * The locale is the *reader's*, not the instance's default: a plug-in renders
   * inside this page and would otherwise be the one English box on a German one.
   */
  protected readonly pluginContext = computed(() => ({
    eventId: this.event()?.id ?? '',
    locale: this.i18n.locale(),
  }));

  constructor() {
    effect(() => {
      void this.load(this.seriesSlug(), this.eventSlug());
    });
  }

  protected when(): string {
    const event = this.event();
    return event ? formatEventPeriod(event, this.i18n.locale()) : '';
  }

  /** The links of one session — its recording, its slides (FR 3.6). */
  protected sessionLinks(item: PublicProgramItem): readonly PublicMediaLink[] {
    return programItemMediaLinks(this.links(), item.id);
  }

  /** The session's clock range, in the event's zone — never the reader's (E8). */
  protected clock(item: PublicProgramItem): string {
    const event = this.event();
    return event
      ? formatProgramTime(item, event.timezone, this.i18n.locale())
      : '';
  }

  /**
   * What is left of a session with a seat limit (FR 3.10).
   *
   * A number, never a name: this page is public, and who attends which workshop
   * is not. What it does say is whether it is worth registering for — a full
   * session that looks open is the worse of the two mistakes.
   */
  protected seats(item: PublicProgramItem): string {
    const left = seatsLeft(item);
    if (left === null) {
      return this.i18n.translate('event.seats.open', {
        count: item.signupCount,
      });
    }
    return isProgramItemFull(item)
      ? this.i18n.translate('event.seats.full', {
          count: item.signupCount,
          capacity: item.capacity,
        })
      : this.i18n.translate('event.seats.free', {
          left,
          capacity: item.capacity,
        });
  }

  /** Spelled out rather than shown as a raw enum value. */
  protected format(): string {
    switch (this.event()?.eventType) {
      case 'online':
        return this.i18n.translate('event.online');
      case 'hybrid':
        return this.i18n.translate('event.onSiteAndOnline');
      default:
        return this.i18n.translate('event.onSite');
    }
  }

  private async load(seriesSlug: string, eventSlug: string): Promise<void> {
    this.error.set(null);
    this.items.set([]);
    this.links.set([]);
    try {
      this.event.set(await this.events.get(seriesSlug, eventSlug));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? { key: 'event.errorMissing', detail: null }
          : problemOf(error, 'event.error'),
      );
      return;
    }

    // Both after the event and never before it: the programme's days are counted
    // in the event's zone. Either one failing leaves the page standing — the
    // event's own facts are the part somebody came for.
    await Promise.all([
      this.loadProgram(seriesSlug, eventSlug),
      this.loadMediaLinks(seriesSlug, eventSlug),
    ]);
  }

  private async loadProgram(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<void> {
    try {
      this.items.set(await this.program.list(seriesSlug, eventSlug));
    } catch {
      this.items.set([]);
    }
  }

  /**
   * The media links, if this instance has the module switched on (FR 1.5).
   *
   * Not asked for otherwise: the endpoint answers 404 while the module is off
   * (F53), and a request whose answer is known is a request not worth making.
   */
  private async loadMediaLinks(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<void> {
    if (!this.config.isModuleEnabled(MEDIA_LINKS_MODULE_KEY)) {
      this.links.set([]);
      return;
    }
    try {
      this.links.set(await this.mediaLinks.list(seriesSlug, eventSlug));
    } catch {
      this.links.set([]);
    }
  }
}
