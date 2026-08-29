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
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  EventTranslations,
  ProgramItemTranslations,
} from '@trefaro/shared-models';
import {
  MAX_CONTENT_DESCRIPTION_LENGTH,
  MAX_CONTENT_NAME_LENGTH,
  MAX_FOLLOW_UP_LENGTH,
  MAX_PROGRAM_DESCRIPTION_LENGTH,
  MAX_PROGRAM_TITLE_LENGTH,
  MAX_VENUE_NAME_LENGTH,
  formatInstant,
} from '@trefaro/shared-models';
import { ContentTranslationsAdminService } from '../../features/content-translations/content-translations-admin.service';
import { targetLocales } from './target-locales';
import {
  TranslationFieldsComponent,
  type TranslationDraft,
  type TranslationFieldSpec,
} from './translation-fields';
import { TranslationLanguagesComponent } from './translation-languages';

/** One session on the screen: what it says, when it is, and what to edit. */
interface SessionSection {
  readonly id: string;
  readonly title: string;
  readonly when: string;
  readonly translation: TranslationDraft | null;
  readonly fields: readonly TranslationFieldSpec[];
}

/**
 * Translating one event and its programme (FR 3.12, UC 12).
 *
 * One screen and one request for the whole event (F49): an organizer
 * translating into German does the header and the sessions in one sitting, and a
 * page per session would be twenty pages for a conference.
 *
 * The *saves* stay one per thing. A single button over the whole event would
 * mean that a title too long in session nineteen throws away the eighteen before
 * it — and a translator works session by session anyway.
 */
@Component({
  selector: 'trefaro-event-translations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    TranslationFieldsComponent,
    TranslationLanguagesComponent,
  ],
  template: `
    <header class="head">
      <div>
        <h1>{{ 'admin.translations.title' | transloco }}</h1>
        <p class="meta">
          @if (data(); as screen) {
            <a [routerLink]="['/series', seriesId(), 'events', eventId()]">{{
              screen.source.name
            }}</a>
          }
          <span>{{ 'admin.translations.intro' | transloco }}</span>
        </p>
      </div>
      <a
        class="back"
        [routerLink]="['/series', seriesId(), 'events', eventId()]"
      >
        {{ 'admin.events.back' | transloco }}
      </a>
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }
    @if (notice(); as key) {
      <p class="hint" role="status">{{ key | transloco }}</p>
    }

    @if (!data()) {
      <p class="meta">{{ 'common.loading' | transloco }}</p>
    } @else if (locales().length === 0) {
      <p class="hint">{{ 'admin.translations.noLanguages' | transloco }}</p>
    } @else {
      <trefaro-translation-languages
        [locales]="locales()"
        [active]="active()"
        [label]="'admin.translations.languages' | transloco"
        (chosen)="active.set($event)"
      />

      <p class="meta">
        {{ 'admin.translations.emptyMeansOriginal' | transloco }}
      </p>
      <p class="hint">{{ 'admin.translations.notTranslated' | transloco }}</p>

      <section aria-labelledby="event-translation">
        <h2 id="event-translation">
          {{ 'admin.translations.eventSection' | transloco }}
        </h2>
        <trefaro-translation-fields
          [section]="active() + '-event'"
          [fields]="eventFields()"
          [translation]="eventTranslation()"
          [busy]="busy()"
          (saved)="saveEvent($event)"
          (removed)="removeEvent()"
        />
      </section>

      <section aria-labelledby="program-translation">
        <h2 id="program-translation">
          {{ 'admin.translations.programSection' | transloco }}
        </h2>

        @if (sessions().length === 0) {
          <p class="meta">{{ 'admin.translations.noProgram' | transloco }}</p>
        }

        @for (session of sessions(); track session.id) {
          <article class="session">
            <h3>{{ session.title }}</h3>
            <p class="meta">{{ session.when }}</p>
            <trefaro-translation-fields
              [section]="active() + '-item-' + session.id"
              [fields]="session.fields"
              [translation]="session.translation"
              [busy]="busy()"
              (saved)="saveItem(session.id, $event)"
              (removed)="removeItem(session.id)"
            />
          </article>
        }
      </section>
    }
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      flex-wrap: wrap;
    }

    .meta {
      color: var(--trefaro-color-text-muted, #555);
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .error {
      color: var(--trefaro-color-primary-strong);
    }

    .error__detail,
    .hint {
      color: var(--trefaro-color-text-muted, #555);
    }

    .session {
      padding: 0.9rem 1rem;
      margin-block-end: 1rem;
      border-radius: 0.5rem;
      background: var(--trefaro-color-surface, #fff);
      box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
    }

    .session h3 {
      margin-block: 0 0.2rem;
    }
  `,
})
export class EventTranslationsPage {
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  private readonly translations = inject(ContentTranslationsAdminService);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);

  protected readonly data = signal<EventTranslations | null>(null);
  protected readonly active = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<Problem | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly items = computed<readonly ProgramItemTranslations[]>(
    () => this.data()?.programItems ?? [],
  );

  /**
   * Every language anything on this screen has been translated into.
   *
   * The sessions count too: an organizer who translated the programme and then
   * stopped offering that language must still find the work.
   */
  protected readonly locales = computed(() => {
    const screen = this.data();
    const translated = [
      ...Object.keys(screen?.translations ?? {}),
      ...(screen?.programItems ?? []).flatMap((item) =>
        Object.keys(item.translations),
      ),
    ];
    return targetLocales(this.config.config(), translated);
  });

  protected readonly eventTranslation = computed<TranslationDraft | null>(
    () => this.data()?.translations[this.active()] ?? null,
  );

  protected readonly eventFields = computed<readonly TranslationFieldSpec[]>(
    () => {
      const source = this.data()?.source;
      return [
        {
          key: 'name',
          labelKey: 'admin.events.name',
          source: source?.name ?? null,
          maxLength: MAX_CONTENT_NAME_LENGTH,
        },
        {
          key: 'description',
          labelKey: 'admin.events.description',
          source: source?.description ?? null,
          maxLength: MAX_CONTENT_DESCRIPTION_LENGTH,
          multiline: true,
        },
        {
          key: 'venueName',
          labelKey: 'admin.events.venueName',
          source: source?.venueName ?? null,
          maxLength: MAX_VENUE_NAME_LENGTH,
        },
        {
          key: 'followUpBody',
          labelKey: 'admin.events.followUp',
          source: source?.followUpBody ?? null,
          maxLength: MAX_FOLLOW_UP_LENGTH,
          multiline: true,
        },
      ];
    },
  );

  constructor() {
    effect(() => {
      void this.load(this.eventId());
    });

    effect(() => {
      const offered = this.locales();
      if (offered.length > 0 && !offered.includes(this.active())) {
        this.active.set(offered[0]);
      }
    });
  }

  /**
   * One editable section per session: what it is, and what it says in this tab.
   *
   * A `computed()` and not three template methods, which is what it was until
   * the browser suite caught the consequence: a method rebuilds its array on
   * every change detection run, the child's `fields` input changes identity, and
   * an effect that watched it reset the box somebody was typing into. Memoised
   * here, the arrays change when the data or the tab does — which is exactly
   * when the form should be refilled.
   *
   * The reader's language is read here rather than left to a pipe, for the other
   * half of F72: `when` is assembled in TypeScript and has nothing to redraw it.
   * The *zone* stays the event's (E8); only the wording of the date follows the
   * reader.
   */
  protected readonly sessions = computed<readonly SessionSection[]>(() => {
    const locale = this.active();
    const timezone = this.data()?.timezone ?? '';
    const readIn = this.i18n.locale();

    return this.items().map((item) => ({
      id: item.id,
      title: item.source.title ?? '',
      when: timezone ? formatInstant(item.startsAt, timezone, readIn) : '',
      translation: item.translations[locale] ?? null,
      fields: [
        {
          key: 'title',
          labelKey: 'admin.program.topic',
          source: item.source.title,
          maxLength: MAX_PROGRAM_TITLE_LENGTH,
        },
        {
          key: 'description',
          labelKey: 'admin.program.description',
          source: item.source.description,
          maxLength: MAX_PROGRAM_DESCRIPTION_LENGTH,
          multiline: true,
        },
      ],
    }));
  });

  protected saveEvent(draft: TranslationDraft): Promise<void> {
    return this.run('admin.translations.saved', () =>
      this.translations.writeEvent(this.eventId(), this.active(), {
        name: draft['name'] ?? null,
        description: draft['description'] ?? null,
        venueName: draft['venueName'] ?? null,
        followUpBody: draft['followUpBody'] ?? null,
      }),
    );
  }

  protected removeEvent(): Promise<void> {
    return this.run('admin.translations.removed', () =>
      this.translations.removeEvent(this.eventId(), this.active()),
    );
  }

  protected saveItem(id: string, draft: TranslationDraft): Promise<void> {
    return this.run('admin.translations.saved', () =>
      this.translations.writeProgramItem(id, this.active(), {
        title: draft['title'] ?? null,
        description: draft['description'] ?? null,
      }),
    );
  }

  protected removeItem(id: string): Promise<void> {
    return this.run('admin.translations.removed', () =>
      this.translations.removeProgramItem(id, this.active()),
    );
  }

  private async load(id: string): Promise<void> {
    try {
      this.data.set(await this.translations.event(id));
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.translations.errorLoad'));
    }
  }

  /** See the same method on the series page for why the screen is read back. */
  private async run(
    noticeKey: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
      this.data.set(await this.translations.event(this.eventId()));
      this.notice.set(noticeKey);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.translations.errorSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
