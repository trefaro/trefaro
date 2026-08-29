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
import type { EventSeriesTranslations } from '@trefaro/shared-models';
import {
  MAX_CONTENT_DESCRIPTION_LENGTH,
  MAX_CONTENT_NAME_LENGTH,
} from '@trefaro/shared-models';
import { ContentTranslationsAdminService } from '../../features/content-translations/content-translations-admin.service';
import { targetLocales } from './target-locales';
import {
  TranslationFieldsComponent,
  type TranslationDraft,
  type TranslationFieldSpec,
} from './translation-fields';
import { TranslationLanguagesComponent } from './translation-languages';

/**
 * Translating one event series (FR 3.12, UC 12).
 *
 * Its own page rather than a section of the series form, deliberately: the main
 * form is what the organization writes, and this is what it says elsewhere. Two
 * languages in one form would make "which one am I editing" a thing to check
 * before every keystroke.
 */
@Component({
  selector: 'trefaro-series-translations-page',
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
            <a [routerLink]="['/series', id()]">{{ screen.source.name }}</a>
          }
          <span>{{ 'admin.translations.intro' | transloco }}</span>
        </p>
      </div>
      <a class="back" [routerLink]="['/series', id()]">
        {{ 'admin.dashboard.backToSeries' | transloco }}
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

      <trefaro-translation-fields
        [section]="active() + '-series'"
        [fields]="fields()"
        [translation]="current()"
        [busy]="busy()"
        (saved)="save($event)"
        (removed)="remove()"
      />
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
  `,
})
export class SeriesTranslationsPage {
  readonly id = input.required<string>();

  private readonly translations = inject(ContentTranslationsAdminService);
  private readonly config = inject(AppConfigService);

  protected readonly data = signal<EventSeriesTranslations | null>(null);
  protected readonly active = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<Problem | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly locales = computed(() =>
    targetLocales(
      this.config.config(),
      Object.keys(this.data()?.translations ?? {}),
    ),
  );

  protected readonly current = computed<TranslationDraft | null>(
    () => this.data()?.translations[this.active()] ?? null,
  );

  protected readonly fields = computed<readonly TranslationFieldSpec[]>(() => {
    const source = this.data()?.source;
    return [
      {
        key: 'name',
        labelKey: 'admin.series.name',
        source: source?.name ?? null,
        maxLength: MAX_CONTENT_NAME_LENGTH,
      },
      {
        key: 'description',
        labelKey: 'admin.series.description',
        source: source?.description ?? null,
        maxLength: MAX_CONTENT_DESCRIPTION_LENGTH,
        multiline: true,
      },
    ];
  });

  constructor() {
    effect(() => {
      void this.load(this.id());
    });

    // The first tab is chosen once the languages are known, and only while none
    // is chosen: re-selecting after every save would drop an organizer back to
    // the first language whenever they wrote in the third.
    effect(() => {
      const offered = this.locales();
      if (offered.length > 0 && !offered.includes(this.active())) {
        this.active.set(offered[0]);
      }
    });
  }

  protected async save(draft: TranslationDraft): Promise<void> {
    await this.run('admin.translations.saved', () =>
      this.translations.writeSeries(this.id(), this.active(), {
        name: draft['name'] ?? null,
        description: draft['description'] ?? null,
      }),
    );
  }

  protected async remove(): Promise<void> {
    await this.run('admin.translations.removed', () =>
      this.translations.removeSeries(this.id(), this.active()),
    );
  }

  private async load(id: string): Promise<void> {
    try {
      this.data.set(await this.translations.series(id));
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.translations.errorLoad'));
    }
  }

  /**
   * Runs one write and reads the screen back.
   *
   * Read back rather than patched in place: a save may have *removed* a row
   * (every field cleared), and the tab bar is built from which languages have
   * one. Patching would leave a tab for a translation that no longer exists.
   */
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
      this.data.set(await this.translations.series(this.id()));
      this.notice.set(noticeKey);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.translations.errorSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
