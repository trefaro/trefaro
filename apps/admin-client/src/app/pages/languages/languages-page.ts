import { DOCUMENT } from '@angular/common';
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
import type {
  LocaleCatalogueDetail,
  LocaleOverview,
  LocaleSummary,
  TranslationEntry,
  TranslationWriteResult,
} from '@trefaro/shared-models';
import {
  FALLBACK_LOCALE,
  isLocaleTag,
  translationCompleteness,
} from '@trefaro/shared-models';
import { ConfigAdminService } from '../../features/config/config-admin.service';
import { TranslationsAdminService } from '../../features/i18n/translations-admin.service';

/** One row of the editor, with the draft the organizer is typing. */
interface EditorRow {
  readonly entry: TranslationEntry;
  /** What is in the field: the draft if there is one, else the stored text. */
  readonly draft: string;
  /** The stored text of this language — empty when it has none. */
  readonly stored: string;
  readonly dirty: boolean;
}

/** One row of the list of languages, with its figure and its draft flags. */
interface LocaleRow {
  readonly summary: LocaleSummary;
  readonly name: string;
  readonly percent: number;
  readonly offered: boolean;
  readonly isDefault: boolean;
  /** English is never removable: it is the last link of the chain (E23). */
  readonly locked: boolean;
}

/**
 * The language administration (chapter 4, FR 1.4, E22, E23, E30) — AP 7.
 *
 * This is the screen that makes "new languages must be maintainable by the
 * organization" true rather than promised: it lists what exists with how far each
 * has got, edits a key beside its English original, resets one back to what the
 * image ships, offers a language to visitors, and takes a whole file out and in
 * again for translation work done elsewhere.
 *
 * Five decisions worth naming:
 *
 * 1. **Two sections, because they are two decisions.** Which languages are
 *    *offered* is `app_config`; the translations are rows of their own. A
 *    language is created by translating it and offered separately (E30), so
 *    "Deutsch is 67 % done" and "visitors may pick Deutsch" have their own
 *    buttons and their own endpoints.
 * 2. **The offered set is written as a whole.** The default has to be one of the
 *    offered ones, so a checkbox that wrote immediately would have a moment in
 *    which it is not — the drafts live here until *Save offered languages*.
 * 3. **Changes are saved as one request.** Every edited field goes in one `PUT`,
 *    which the server applies in one transaction: a translator working through
 *    twenty keys should not produce twenty half-applied writes.
 * 4. **A field holds this language's own text, not the effective text.** An
 *    empty field is the honest picture of a missing translation — and it is what
 *    makes the export/import round trip work, where an untranslated key is an
 *    empty string. The English text stands beside it, always.
 * 5. **The figures come back from the server after every write.** What a write
 *    meant is the server's decision: an empty value resets a key, and a value
 *    equal to the shipped text stores no row at all (F74). A figure computed
 *    here would eventually disagree with the one the next visit shows.
 */
@Component({
  selector: 'trefaro-languages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'admin.languages.title' | transloco }}</h1>
    <p class="lead">{{ 'admin.languages.lead' | transloco }}</p>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }
    @if (notice()) {
      <p class="notice" role="status">{{ notice() }}</p>
    }

    <section>
      <h2>{{ 'admin.languages.offered' | transloco }}</h2>

      <table [attr.aria-label]="'admin.languages.title' | transloco">
        <thead>
          <tr>
            <th>{{ 'admin.languages.colLanguage' | transloco }}</th>
            <th>{{ 'admin.languages.colTranslated' | transloco }}</th>
            <th>{{ 'admin.languages.colOffered' | transloco }}</th>
            <th>{{ 'admin.languages.colDefault' | transloco }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of localeRows(); track row.summary.locale) {
            <tr [class.is-editing]="row.summary.locale === selected()">
              <td>
                <strong>{{ row.name }}</strong>
                <br /><code>{{ row.summary.locale }}</code>
                @if (!row.summary.shipped) {
                  <br /><small>
                    {{ 'admin.languages.addedByOrg' | transloco }}
                  </small>
                }
              </td>
              <td>
                <span class="percent">{{ row.percent }}%</span>
                <br /><small>
                  {{
                    'admin.languages.keysOf'
                      | transloco
                        : {
                            translated: row.summary.translated,
                            total: row.summary.total,
                          }
                  }}
                  @if (row.summary.overrides > 0) {
                    {{
                      'admin.languages.writtenHere'
                        | transloco: { count: row.summary.overrides }
                    }}
                  }
                </small>
              </td>
              <td>
                <label class="tick">
                  <input
                    type="checkbox"
                    [checked]="row.offered"
                    [disabled]="row.locked || busy() !== null"
                    (change)="setOffered(row.summary.locale, $event)"
                  />
                  <span class="visually-hidden">
                    {{
                      'admin.languages.offerVisitors'
                        | transloco: { name: row.name }
                    }}
                  </span>
                </label>
              </td>
              <td>
                <label class="tick">
                  <input
                    type="radio"
                    name="default-locale"
                    [checked]="row.isDefault"
                    [disabled]="!row.offered || busy() !== null"
                    (change)="setDefault(row.summary.locale)"
                  />
                  <span class="visually-hidden">
                    {{
                      'admin.languages.makeDefault'
                        | transloco: { name: row.name }
                    }}
                  </span>
                </label>
              </td>
              <td>
                <button
                  type="button"
                  [disabled]="busy() !== null"
                  (click)="edit(row.summary.locale)"
                >
                  {{ 'admin.languages.translate' | transloco }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">
                {{
                  (loading() ? 'common.loading' : 'admin.languages.noLanguage')
                    | transloco
                }}
              </td>
            </tr>
          }
        </tbody>
      </table>

      <p class="actions">
        <button
          type="button"
          [disabled]="!localesDirty() || busy() !== null"
          (click)="saveLocales()"
        >
          {{ 'admin.languages.saveOffered' | transloco }}
        </button>
        @if (localesDirty()) {
          <button type="button" [disabled]="busy() !== null" (click)="reload()">
            {{ 'admin.languages.discard' | transloco }}
          </button>
        }
      </p>

      <form class="add" (submit)="addLanguage($event)">
        <label for="new-locale">
          {{ 'admin.languages.addLanguage' | transloco }}
        </label>
        <input
          id="new-locale"
          name="new-locale"
          [value]="newTag()"
          (input)="newTag.set(asValue($event))"
          placeholder="fr"
          autocomplete="off"
          aria-describedby="new-locale-hint"
        />
        <button type="submit" [disabled]="busy() !== null">
          {{ 'admin.languages.add' | transloco }}
        </button>
        <!-- The three example tags travel as parameters: they are identifiers,
             not words, and a key with them inside would invite translating
             them. -->
        <small id="new-locale-hint">
          {{
            'admin.languages.addHint'
              | transloco: { first: 'fr', second: 'pt-BR', third: 'tr' }
          }}
        </small>
      </form>
    </section>

    @if (selected(); as locale) {
      <section class="editor">
        <h2>
          {{ languageName(locale) }}
          <code>{{ locale }}</code>
          @if (detail(); as loaded) {
            <span class="percent">{{ percentOf(loaded) }}%</span>
          }
        </h2>

        <p class="toolbar">
          <label class="tick" for="only-missing">
            <input
              id="only-missing"
              type="checkbox"
              [checked]="onlyMissing()"
              (change)="onlyMissing.set(asChecked($event))"
            />
            {{ 'admin.languages.onlyMissing' | transloco }}
          </label>

          <label class="search">
            <span>{{ 'admin.languages.search' | transloco }}</span>
            <input
              type="search"
              [value]="search()"
              (input)="search.set(asValue($event))"
              [placeholder]="'admin.languages.searchPlaceholder' | transloco"
            />
          </label>

          <button type="button" [disabled]="!detail()" (click)="exportFile()">
            {{ 'admin.languages.exportJson' | transloco }}
          </button>

          <label class="import">
            <span>{{ 'admin.languages.importJson' | transloco }}</span>
            <input
              type="file"
              accept="application/json,.json"
              [disabled]="busy() !== null"
              (change)="importFile($event)"
            />
          </label>
        </p>

        <p class="actions">
          <button
            type="button"
            [disabled]="dirtyRows().length === 0 || busy() !== null"
            (click)="saveDrafts()"
          >
            {{ saveLabel() }}
          </button>
          @if (dirtyRows().length > 0) {
            <button
              type="button"
              [disabled]="busy() !== null"
              (click)="discardDrafts()"
            >
              {{ 'admin.design.discard' | transloco }}
            </button>
          }
        </p>

        <table
          class="entries"
          [attr.aria-label]="'admin.languages.tableEntries' | transloco"
        >
          <thead>
            <tr>
              <th>{{ 'admin.languages.colKey' | transloco }}</th>
              <th>{{ 'admin.languages.colEnglish' | transloco }}</th>
              <th>{{ languageName(locale) }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.entry.key) {
              <tr [class.is-dirty]="row.dirty">
                <td>
                  <code>{{ row.entry.key }}</code>
                </td>
                <td class="english">{{ row.entry.english }}</td>
                <td>
                  <textarea
                    rows="2"
                    [value]="row.draft"
                    [attr.aria-label]="row.entry.key"
                    [placeholder]="row.entry.english"
                    [disabled]="busy() !== null"
                    (input)="setDraft(row.entry.key, asValue($event))"
                  ></textarea>
                </td>
                <td>
                  <span [class]="'state state--' + row.entry.state">
                    {{ stateKey(row.entry.state) | transloco }}
                  </span>
                  @if (row.entry.override !== null) {
                    <br /><button
                      type="button"
                      [disabled]="busy() !== null"
                      (click)="resetKey(row.entry.key)"
                    >
                      {{ 'admin.languages.reset' | transloco }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  {{
                    (detail()
                      ? 'admin.languages.noKeyMatches'
                      : 'admin.languages.loadingLanguage'
                    ) | transloco
                  }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .lead {
      max-inline-size: 44rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    section {
      margin-block-start: 2rem;
    }

    h2 {
      display: flex;
      gap: 0.6rem;
      align-items: baseline;
      font-size: 1.1rem;
    }

    table {
      border-collapse: collapse;
      inline-size: 100%;
      font-size: 0.9rem;
    }

    th,
    td {
      text-align: start;
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid var(--trefaro-color-primary-muted);
      vertical-align: top;
    }

    tr.is-editing {
      background: var(--trefaro-color-primary-muted);
    }

    tr.is-dirty td {
      border-inline-start: 3px solid var(--trefaro-color-accent-strong);
    }

    .percent {
      font-weight: 600;
      color: var(--trefaro-color-primary-strong);
    }

    .english {
      max-inline-size: 22rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    textarea {
      inline-size: 100%;
      min-inline-size: 14rem;
      font: inherit;
      padding: 0.35rem 0.4rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.3rem;
      resize: vertical;
    }

    .state {
      font-size: 0.8rem;
    }

    .state--missing {
      color: #8a5b1a;
    }

    .state--overridden {
      color: var(--trefaro-color-primary-strong);
    }

    .toolbar,
    .actions,
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      align-items: center;
      margin-block: 0.8rem;
    }

    .add small {
      flex-basis: 100%;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .add input {
      font: inherit;
      padding: 0.35rem 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.3rem;
      inline-size: 8rem;
    }

    .search input {
      font: inherit;
      padding: 0.35rem 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.3rem;
    }

    .tick,
    .search,
    .import {
      display: inline-flex;
      gap: 0.4rem;
      align-items: center;
    }

    button {
      padding: 0.35rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    button:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .error {
      color: #a3341f;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class LanguagesPage {
  private readonly translations = inject(TranslationsAdminService);
  private readonly configAdmin = inject(ConfigAdminService);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);
  private readonly document = inject(DOCUMENT);

  protected readonly overview = signal<LocaleOverview | null>(null);
  protected readonly detail = signal<LocaleCatalogueDetail | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<Problem | null>(null);
  /**
   * A finished sentence, not a key.
   *
   * Unlike every other notice in this client, this one is assembled from a
   * variable number of clauses ("3 written, 1 reset, 2 unknown keys ignored"),
   * so there is no single key to hand the template. It is the record of an
   * action at the moment it happened, and it keeps the language it happened in.
   */
  protected readonly notice = signal<string | null>(null);
  /** What is being written right now, so one click disables every button. */
  protected readonly busy = signal<string | null>(null);

  /** The offered set as it is being edited — written only on Save. */
  protected readonly draftActive = signal<readonly string[]>([]);
  protected readonly draftDefault = signal<string>(FALLBACK_LOCALE);
  protected readonly newTag = signal('');

  /**
   * Tags added on this visit that the server does not list yet.
   *
   * A language is listed once it has a translation or is offered (E30) — so a tag
   * that has neither would vanish from the list the moment the list is re-read,
   * including right after resetting its last key. Keeping it here is what lets an
   * organizer work on a language that does not exist yet without the row moving
   * under their hands.
   */
  protected readonly pending = signal<readonly string[]>([]);

  /** Edited fields by key; empty means "as stored". */
  protected readonly drafts = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly onlyMissing = signal(false);
  protected readonly search = signal('');

  /**
   * The list of languages, each with its name in the organizer's language.
   *
   * The name is computed here rather than in a method the template calls,
   * because this client is zoneless and the page is `OnPush`: a language change
   * repaints only what depends on something that changed.
   * {@link TranslationService.languageName} reads the active-language signal, so
   * reading it inside this computed is what registers the dependency — the same
   * move the module administration makes for its module names.
   */
  protected readonly localeRows = computed<readonly LocaleRow[]>(() => {
    const overview = this.overview();
    if (!overview) return [];
    const active = this.draftActive();
    const chosen = this.draftDefault();

    return overview.locales.map((summary) => ({
      summary,
      name: this.languageName(summary.locale),
      percent: translationCompleteness(summary),
      offered: active.includes(summary.locale),
      isDefault: chosen === summary.locale,
      locked: summary.locale === FALLBACK_LOCALE,
    }));
  });

  /** Whether the offered set differs from what the server stores. */
  protected readonly localesDirty = computed(() => {
    const overview = this.overview();
    if (!overview) return false;
    const stored = overview.locales
      .filter((summary) => summary.active)
      .map((summary) => summary.locale);
    return (
      this.draftDefault() !== overview.defaultLocale ||
      stored.join(' ') !== this.draftActive().join(' ')
    );
  });

  /** Every entry of the selected language, filter applied. */
  protected readonly visibleRows = computed<readonly EditorRow[]>(() => {
    const detail = this.detail();
    if (!detail) return [];
    const needle = this.search().trim().toLowerCase();
    const onlyMissing = this.onlyMissing();

    return this.rowsOf(detail).filter((row) => {
      if (onlyMissing && row.entry.state !== 'missing') return false;
      if (needle === '') return true;
      return (
        row.entry.key.toLowerCase().includes(needle) ||
        row.entry.english.toLowerCase().includes(needle)
      );
    });
  });

  /**
   * The rows that would be written, filter or no filter.
   *
   * Deliberately not `visibleRows`: switching a filter on must not silently drop
   * an edit the organizer already typed.
   */
  /** The save button's own text, so the template holds no arithmetic. */
  protected readonly saveLabel = computed(() => {
    this.i18n.locale();
    const count = this.dirtyRows().length;
    if (count === 0) return this.i18n.translate('admin.languages.saveChanges');
    return this.i18n.translate(
      count === 1
        ? 'admin.languages.saveCount.one'
        : 'admin.languages.saveCount.many',
      { count },
    );
  });

  protected readonly dirtyRows = computed<readonly EditorRow[]>(() => {
    const detail = this.detail();
    if (!detail) return [];
    return this.rowsOf(detail).filter((row) => row.dirty);
  });

  constructor() {
    void this.reload();
  }

  protected languageName(locale: string): string {
    return this.i18n.languageName(locale);
  }

  protected percentOf(summary: LocaleSummary): number {
    return translationCompleteness(summary);
  }

  protected stateKey(state: TranslationEntry['state']): string {
    return `admin.languages.state.${state}`;
  }

  /** Reads a value out of an input event without a cast at every call site. */
  protected asValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected discardDrafts(): void {
    this.drafts.set(new Map());
  }

  protected setDraft(key: string, value: string): void {
    const next = new Map(this.drafts());
    next.set(key, value);
    this.drafts.set(next);
  }

  protected setOffered(locale: string, event: Event): void {
    const offered = this.asChecked(event);
    const active = this.draftActive().filter((tag) => tag !== locale);
    // Appended rather than sorted: the order of this list is the order of the
    // switcher in both clients, so it is a choice, not a detail.
    this.draftActive.set(offered ? [...active, locale] : active);
    if (!offered && this.draftDefault() === locale) {
      // A default nobody is offered is refused by the server; correcting it here
      // means the organizer sees what will be saved rather than an error.
      this.draftDefault.set(FALLBACK_LOCALE);
    }
  }

  protected setDefault(locale: string): void {
    this.draftDefault.set(locale);
  }

  /**
   * Puts a new tag on the list so it can be translated.
   *
   * Not written yet, and not offered: a language exists because somebody
   * translated it (E30), so this adds a row and selects it. What reaches the
   * server is either a translation, or — after *Save offered languages* — the
   * decision to show it to visitors.
   */
  protected addLanguage(event: Event): void {
    event.preventDefault();
    const tag = this.newTag().trim().toLowerCase();
    this.error.set(null);
    this.notice.set(null);

    if (!isLocaleTag(tag)) {
      this.error.set({ key: 'admin.languages.errorTag', detail: null });
      return;
    }

    const overview = this.overview();
    if (overview?.locales.some((summary) => summary.locale === tag)) {
      this.newTag.set('');
      this.notice.set(
        this.i18n.translate('admin.languages.alreadyOnList', {
          name: this.languageName(tag),
        }),
      );
      void this.edit(tag);
      return;
    }

    // Shown immediately, with the figures the server would give it: nothing
    // translated, no shipped file, not offered.
    this.pending.set([...this.pending(), tag]);
    if (overview) this.overview.set(this.merged(overview));
    this.newTag.set('');
    this.notice.set(
      this.i18n.translate('admin.languages.readyToTranslate', {
        name: this.languageName(tag),
      }),
    );
    void this.edit(tag);
  }

  protected async edit(locale: string): Promise<void> {
    this.selected.set(locale);
    this.detail.set(null);
    this.drafts.set(new Map());
    this.error.set(null);
    try {
      this.detail.set(await this.translations.detail(locale));
    } catch (error: unknown) {
      this.report(error, 'admin.languages.errorDetail');
    }
  }

  protected async saveLocales(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('locales');
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.configAdmin.setLocales({
        defaultLocale: this.draftDefault(),
        activeLocales: this.draftActive(),
      });
      await this.reload();
      // This client's own switcher reads the cached configuration, so it has to
      // re-read before the new language appears in it.
      await this.config.reload();
      this.notice.set(this.i18n.translate('admin.languages.savedLocales'));
    } catch (error: unknown) {
      this.report(error, 'admin.languages.errorSaveLocales');
    } finally {
      this.busy.set(null);
    }
  }

  /** Writes every edited field in one request, which the server applies once. */
  protected async saveDrafts(): Promise<void> {
    const locale = this.selected();
    const rows = this.dirtyRows();
    if (!locale || rows.length === 0 || this.busy()) return;

    const entries: Record<string, string> = {};
    for (const row of rows) entries[row.entry.key] = row.draft;

    this.busy.set('drafts');
    this.error.set(null);
    this.notice.set(null);
    try {
      const result = await this.translations.write(locale, entries);
      this.drafts.set(new Map());
      await Promise.all([this.refreshDetail(locale), this.refreshOverview()]);
      this.notice.set(this.describe(result));
    } catch (error: unknown) {
      this.report(error, 'admin.languages.errorSaveDrafts');
    } finally {
      this.busy.set(null);
    }
  }

  protected async resetKey(key: string): Promise<void> {
    const locale = this.selected();
    if (!locale || this.busy()) return;

    this.busy.set(key);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.translations.reset(locale, key);
      // The draft goes too: the field now shows what the image ships, and a
      // leftover draft would look like an unsaved change to something reset.
      const next = new Map(this.drafts());
      next.delete(key);
      this.drafts.set(next);
      await Promise.all([this.refreshDetail(locale), this.refreshOverview()]);
      this.notice.set(
        this.i18n.translate('admin.languages.resetDone', { key }),
      );
    } catch (error: unknown) {
      this.report(error, 'admin.languages.errorReset');
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * Writes this language's own text to a file, one key per line of JSON.
   *
   * Every key, including the untranslated ones — as an empty string, which is
   * exactly what an import reads as "no translation of my own". So the file a
   * translator gets back is the file they were given, with the blanks filled in.
   * Built here rather than fetched, because the editor already has it.
   */
  protected exportFile(): void {
    const detail = this.detail();
    if (!detail) return;

    const payload: Record<string, string> = {};
    for (const row of this.rowsOf(detail)) payload[row.entry.key] = row.draft;

    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
        type: 'application/json',
      }),
    );
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `trefaro-${detail.locale}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const locale = this.selected();
    if (!file || !locale) return;
    // Cleared straight away, so choosing the same file twice is two imports.
    input.value = '';

    this.busy.set('import');
    this.error.set(null);
    this.notice.set(null);
    try {
      const entries = parseCatalogueFile(await file.text());
      const result = await this.translations.write(locale, entries);
      this.drafts.set(new Map());
      await Promise.all([this.refreshDetail(locale), this.refreshOverview()]);
      this.notice.set(this.describe(result));
    } catch (error: unknown) {
      this.report(
        error,
        error instanceof CatalogueFileError
          ? error.key
          : 'admin.languages.errorImport',
      );
    } finally {
      this.busy.set(null);
    }
  }

  /** Re-reads the list and resets the drafts to what the server stores. */
  protected async reload(): Promise<void> {
    try {
      const overview = this.merged(await this.translations.overview());
      this.overview.set(overview);
      this.draftActive.set(
        overview.locales
          .filter((summary) => summary.active)
          .map((summary) => summary.locale),
      );
      this.draftDefault.set(overview.defaultLocale);
    } catch (error: unknown) {
      this.report(error, 'admin.languages.errorLoad');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshOverview(): Promise<void> {
    this.overview.set(this.merged(await this.translations.overview()));
    // The drafts are not touched: an organizer may have ticked a language and
    // then saved a translation, and re-reading must not undo the tick.
  }

  /**
   * The server's list, plus the languages this visit is working on.
   *
   * The server lists a language once it has a translation or is offered, which is
   * right for an answer and wrong for a screen: a tag that was just added, or
   * whose last key was just reset, would disappear while its editor is still
   * open below — and a tick waiting to be saved would go with it.
   */
  private merged(overview: LocaleOverview): LocaleOverview {
    const known = new Set(overview.locales.map((summary) => summary.locale));
    const total = overview.locales[0]?.total ?? 0;
    const extra = [
      ...new Set([...this.pending(), ...this.draftActive()]),
    ].filter((tag) => !known.has(tag));

    if (extra.length === 0) return overview;
    return {
      ...overview,
      locales: [
        ...overview.locales,
        ...extra.map((locale) => ({
          locale,
          shipped: false,
          active: false,
          isDefault: false,
          total,
          translated: 0,
          overrides: 0,
        })),
      ],
    };
  }

  private async refreshDetail(locale: string): Promise<void> {
    this.detail.set(await this.translations.detail(locale));
  }

  /**
   * One row per key, with the draft resolved.
   *
   * The stored text is this language's *own* — its own row, or what the image
   * ships. Not the effective text: a field pre-filled with English would make
   * every key look translated and turn the export into a copy of English.
   */
  private rowsOf(detail: LocaleCatalogueDetail): readonly EditorRow[] {
    const drafts = this.drafts();
    return detail.entries.map((entry) => {
      const stored = entry.override ?? entry.shipped ?? '';
      const draft = drafts.get(entry.key) ?? stored;
      return { entry, draft, stored, dirty: draft !== stored };
    });
  }

  /** What a write did, in one sentence — the server's counts, not a guess. */
  private describe(result: TranslationWriteResult): string {
    const parts: string[] = [];
    if (result.written > 0) {
      parts.push(
        this.i18n.translate('admin.languages.written', {
          count: result.written,
        }),
      );
    }
    if (result.reset > 0) {
      parts.push(
        this.i18n.translate('admin.languages.resetCount', {
          count: result.reset,
        }),
      );
    }
    if (result.unchanged > 0) {
      parts.push(
        this.i18n.translate('admin.languages.unchanged', {
          count: result.unchanged,
        }),
      );
    }
    if (result.ignored.length > 0) {
      parts.push(
        this.i18n.translate(
          result.ignored.length === 1
            ? 'admin.languages.ignored.one'
            : 'admin.languages.ignored.many',
          { count: result.ignored.length, keys: result.ignored.join(', ') },
        ),
      );
    }
    return parts.length > 0
      ? this.i18n.translate('admin.languages.savedSummary', {
          parts: parts.join(', '),
        })
      : this.i18n.translate('admin.languages.nothingChanged');
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}

/**
 * A file this page refused, with the key that says why.
 *
 * The reason is written here, so it is this client's sentence and belongs in
 * the catalogue — unlike a refusal from the server, which arrives in English
 * beside a key of ours (F77).
 */
class CatalogueFileError extends Error {
  constructor(
    readonly key: string,
    readonly params?: Readonly<Record<string, unknown>>,
  ) {
    super(key);
  }
}

/**
 * Reads an exported file back, or says why it cannot.
 *
 * Only the shape is checked here — a flat object of strings. Which keys exist is
 * the server's answer, and it reports the ones it does not know rather than
 * refusing the file: a translation file from an older or newer image is the
 * normal case for work done outside the application.
 */
function parseCatalogueFile(text: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogueFileError('admin.languages.importNotJson');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CatalogueFileError('admin.languages.importNotObject');
  }

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new CatalogueFileError('admin.languages.importValueNotText', {
        key,
      });
    }
    entries[key] = value;
  }

  if (Object.keys(entries).length === 0) {
    throw new CatalogueFileError('admin.languages.importEmpty');
  }
  return entries;
}
