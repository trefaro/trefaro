import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { FALLBACK_LOCALE } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Where a visitor's choice of language is kept.
 *
 * `localStorage` and not a cookie: nothing on the server reads it, the two
 * clients are separate origins and would not share a cookie anyway, and a
 * preference that travels with every request is a preference the server has to
 * ignore explicitly. It also survives a session, which is the point — a
 * participant who switched to German once should not switch again tomorrow.
 */
const STORAGE_KEY = 'trefaro.locale';

/**
 * The active language of a client (chapter 4, E22, E23).
 *
 * Owns three things Transloco does not: which language a visitor gets *first*,
 * that a switch is not visible until the text has arrived, and that
 * `<html lang>` says what the page is actually in.
 *
 * **A switch loads before it activates.** `TranslocoService.setActiveLang()`
 * returns immediately and keeps rendering the previous language until the new
 * catalogue arrives over the network — so a click on "Deutsch" would leave the
 * interface in English with nothing to explain why. {@link use} therefore awaits
 * the load and only then activates, and {@link switching} is true in between so a
 * shell can say so. (This is the second finding of the zoneless check that
 * opened AP 6; the first, that a language change repaints at all, is pinned in
 * `zoneless-language-change.spec.ts`.)
 *
 * **`<html lang>` is not decoration.** A screen reader picks its pronunciation
 * from it (NFR 4), and a page that says `lang="en"` while showing German is read
 * out as English words. Set on every activation, next to the switch, because
 * those are the same event.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly transloco = inject(TranslocoService);
  private readonly config = inject(AppConfigService);
  private readonly document = inject(DOCUMENT);

  private readonly active = signal(FALLBACK_LOCALE);
  private readonly pending = signal<string | null>(null);

  /**
   * The language the interface is in.
   *
   * A signal, so a `computed()` that builds a label in a class — rather than in
   * a template, where the pipe does it — recomputes when the language changes.
   * That is the pattern for anything assembled in TypeScript: read this, then
   * call {@link translate}.
   */
  readonly locale = this.active.asReadonly();

  /** The language being fetched, or `null` when none is. */
  readonly switching = computed(() => this.pending() !== null);

  /**
   * The languages an organization offers, English always among them (NFR 4).
   *
   * From the configuration rather than from a constant: which languages exist is
   * a runtime fact from AP 7 onward, when an organization creates one by
   * translating it.
   */
  readonly availableLocales = computed<readonly string[]>(() => {
    const offered = this.config.config()?.availableLocales ?? [];
    return offered.length > 0 ? offered : [FALLBACK_LOCALE];
  });

  /**
   * Announces the offered languages to Transloco and activates the first one.
   *
   * Called once, from the startup provider, after the configuration has arrived
   * - `availableLangs` cannot be a compile-time list when the set of languages
   * lives in the database.
   */
  async start(): Promise<void> {
    const available = this.availableLocales();
    this.transloco.setAvailableLangs([...available]);

    // Not through {@link use}: this language was *derived*, not chosen. Storing
    // it would turn "your browser asks for German" into "you picked German",
    // and a visitor who later changes their browser would keep getting the old
    // one with nothing to explain why.
    await this.activate(this.initialLocale(available));
  }

  /**
   * Switches language, at a visitor's request, and remembers it.
   *
   * Remembered only on success: a language whose catalogue could not be fetched
   * is not one to greet this visitor with tomorrow.
   */
  async use(locale: string): Promise<void> {
    await this.activate(locale);
    this.remember(locale);
  }

  /**
   * Fetch, then activate — never the other way round.
   *
   * `setActiveLang()` returns immediately and keeps rendering the previous
   * language until the catalogue arrives over the network, so activating first
   * would leave the interface in the old language with the new one selected.
   *
   * The load runs even when the language is already the active one. It is cached
   * inside Transloco, so the cost is nothing — and skipping it would leave the
   * very first call with no catalogue at all: `active` starts on the fallback,
   * so an instance whose language *is* the fallback would have taken the
   * shortcut and rendered its keys until some pipe happened to trigger a load.
   */
  private async activate(locale: string): Promise<void> {
    this.pending.set(locale);
    try {
      await firstValueFrom(this.transloco.load(locale));
      this.transloco.setActiveLang(locale);
      this.active.set(locale);
      this.applyDocumentLanguage(locale);
    } finally {
      this.pending.set(null);
    }
  }

  /**
   * One translated string, for a label assembled in a class.
   *
   * In a template the pipe is better — it re-renders on its own. This exists for
   * the cases where a label is computed: read {@link locale} in the same
   * `computed()` so it recomputes, then call this.
   */
  translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  /**
   * The name of a language, in the language currently active.
   *
   * From `Intl.DisplayNames` and deliberately not from the catalogue. A
   * catalogue entry would need one key per language *per language* — and the
   * whole point of AP 7 is that an organization adds a language nobody
   * anticipated, which would then be nameless in every other language. The
   * platform knows "de" is "Deutsch" in German and "German" in English; falls
   * back to the tag itself for something it does not know.
   */
  languageName(locale: string): string {
    try {
      return (
        new Intl.DisplayNames([this.active()], { type: 'language' }).of(
          locale,
        ) ?? locale
      );
    } catch {
      return locale;
    }
  }

  /**
   * Which language a visitor who has never chosen one gets.
   *
   * In order: what they chose here before, what their browser asks for, what the
   * organization set as its default. The browser's preference is matched on the
   * primary subtag, so a visitor asking for `de-AT` gets an instance's `de` —
   * refusing that would be pedantry with a visible cost.
   */
  private initialLocale(available: readonly string[]): string {
    const stored = this.stored();
    if (stored && available.includes(stored)) return stored;

    for (const requested of this.navigatorLocales()) {
      const match = available.find(
        (candidate) => primary(candidate) === primary(requested),
      );
      if (match) return match;
    }

    const configured = this.config.config()?.defaultLocale;
    if (configured && available.includes(configured)) return configured;

    return available[0] ?? FALLBACK_LOCALE;
  }

  private navigatorLocales(): readonly string[] {
    const nav: unknown = this.document.defaultView?.navigator;
    if (typeof nav !== 'object' || nav === null) return [];
    const languages = (nav as { languages?: readonly string[] }).languages;
    const single = (nav as { language?: string }).language;
    return languages?.length ? languages : single ? [single] : [];
  }

  private applyDocumentLanguage(locale: string): void {
    this.document.documentElement.lang = locale;
  }

  private stored(): string | null {
    try {
      return (
        this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null
      );
    } catch {
      // A browser with storage denied still gets a working application; it just
      // starts from its own language preference every time.
      return null;
    }
  }

  private remember(locale: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* see `stored()` */
    }
  }
}

/** The primary subtag: `de-AT` and `de` are the same language to a visitor. */
function primary(tag: string): string {
  return tag.toLowerCase().split('-')[0];
}
