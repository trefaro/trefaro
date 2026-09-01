import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import type { AppConfigSettings, Theme } from '@trefaro/shared-models';
import {
  DEFAULT_FONT_FAMILY_KEY,
  FONT_FAMILIES,
  HEX_COLOR_PATTERN,
  MAX_ORGANIZATION_NAME_LENGTH,
  fontFamilyStack,
} from '@trefaro/shared-models';
import {
  MIN_DERIVED_TEXT_CONTRAST,
  MIN_SURFACE_CONTRAST,
  PAGE_BACKGROUND_COLOR,
  ThemeService,
  contrastRatio,
  readableTextColor,
} from '@trefaro/shared-theming';
import { ConfigAdminService } from '../../features/config/config-admin.service';
import {
  ImageUploadField,
  type ImageEndpoint,
} from '../../features/images/image-upload-field';

/** What the contrast panel says about one of the two brand colours. */
interface ContrastReading {
  /** Catalogue key, not a word: the panel is built here and drawn there. */
  readonly labelKey: string;
  readonly color: string;
  /** Against the text colour the theme derives for it — never below 4.5:1. */
  readonly onColor: number;
  /** Against the page both clients paint white. */
  readonly onPage: number;
  /** What the colour is for, in one clause — the reason the two differ. */
  readonly roleKey: string;
  /**
   * Whether this colour is what somebody has to *find* on the page.
   *
   * True for the primary colour and false for the accent, which is why only one
   * of the two can produce a warning — see {@link DesignPage.readings}.
   */
  readonly surface: boolean;
  readonly tooPale: boolean;
}

/**
 * The design settings of the instance (FR 1.4, UC 1) — the whole whitelabel
 * story in one page.
 *
 * Four values and two images, and everything interesting here is about *when*
 * they take effect:
 *
 * 1. **The preview is this document.** Typing a colour writes the derived custom
 *    properties onto the running organizer client, so the menu, the buttons and
 *    every plug-in web component change while the form is still open. That is
 *    the only honest preview available — a swatch beside the field would show a
 *    colour, not a user interface.
 * 2. **Discard puts it back**, and so does leaving the page. An unsaved colour
 *    must not follow an organizer to the participant list.
 * 3. **The other client learns of a save on its next load** (E20). Nothing
 *    pushes configuration to a running client, and the page says so rather than
 *    implying a repaint that will not happen.
 * 4. **An image is written when it is uploaded**, not when the form is saved —
 *    which is why the uploads sit in their own section below the form, with
 *    their own buttons, and are not covered by Discard.
 *
 * The contrast panel is the accessibility half (NFR 4), and it says something
 * more useful than "4.5:1" — see {@link readings}.
 */
@Component({
  selector: 'trefaro-design-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImageUploadField, TranslocoPipe],
  template: `
    <header class="head">
      <h1>{{ 'admin.design.title' | transloco }}</h1>
      <p class="meta">{{ 'admin.design.lead' | transloco }}</p>
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }
    @if (saved()) {
      <p class="status" role="status">
        {{ 'admin.design.saved' | transloco }}
      </p>
    }

    <form [formGroup]="form" (ngSubmit)="save()">
      <fieldset [disabled]="loading() || busy()">
        <!-- Hints sit beside the controls and are referenced, not wrapped: a
             label that contains its own explanation makes the accessible name a
             paragraph. -->
        <div class="field">
          <label for="organization-name">
            {{ 'admin.design.organizationName' | transloco }}
          </label>
          <input
            id="organization-name"
            aria-describedby="organization-name-hint"
            formControlName="organizationName"
            [attr.maxlength]="maxNameLength"
            autocomplete="organization"
          />
          <small id="organization-name-hint" class="meta">
            {{ 'admin.design.organizationNameHint' | transloco }}
          </small>
        </div>

        <div class="colours">
          <div class="field">
            <label for="primary-color">
              {{ 'admin.setup.primaryColor' | transloco }}
            </label>
            <input
              id="primary-color"
              type="color"
              formControlName="primaryColor"
            />
            <small class="meta">{{ draft().primaryColor }}</small>
          </div>
          <div class="field">
            <label for="accent-color">
              {{ 'admin.setup.accentColor' | transloco }}
            </label>
            <input
              id="accent-color"
              type="color"
              formControlName="accentColor"
            />
            <small class="meta">{{ draft().accentColor }}</small>
          </div>
        </div>

        <div class="field">
          <label for="font-family">
            {{ 'admin.design.font' | transloco }}
          </label>
          <select
            id="font-family"
            aria-describedby="font-family-hint"
            formControlName="fontFamily"
          >
            <!-- The family names stay as they are: three are proper nouns,
                 and the fourth is worded so it needs no translation (E18, and
                 the note on FontFamilyOption.label). -->
            @for (font of fonts; track font.key) {
              <option [value]="font.key">{{ font.label }}</option>
            }
          </select>
          <small id="font-family-hint" class="meta">
            {{ 'admin.design.fontHint' | transloco }}
          </small>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit" [disabled]="loading() || busy() || !changed()">
          {{ 'admin.common.save' | transloco }}
        </button>
        <button
          type="button"
          [disabled]="loading() || busy() || !changed()"
          (click)="discard()"
        >
          {{ 'admin.design.discard' | transloco }}
        </button>
      </div>
    </form>

    <section aria-labelledby="contrast-heading">
      <h2 id="contrast-heading">
        {{ 'admin.design.legibility' | transloco }}
      </h2>
      <p class="meta">
        {{
          'admin.design.legibilityIntro'
            | transloco: { ratio: minDerivedTextContrast }
        }}
      </p>
      <ul class="readings">
        @for (reading of readings(); track reading.labelKey) {
          <li>
            <span class="swatch" [style.background]="reading.color"></span>
            <!-- One key for the whole line: three fragments around a bold name
                 cannot be reordered by a translator (F79). -->
            <span>
              {{
                'admin.design.reading'
                  | transloco
                    : {
                        label: reading.labelKey | transloco,
                        role: reading.roleKey | transloco,
                        onColor: ratio(reading.onColor),
                        onPage: ratio(reading.onPage),
                      }
              }}
            </span>
            @if (reading.tooPale) {
              <span class="warning" role="status">
                {{
                  'admin.design.tooPale'
                    | transloco: { ratio: minSurfaceContrast }
                }}
              </span>
            }
          </li>
        }
      </ul>
    </section>

    <section aria-labelledby="preview-heading">
      <h2 id="preview-heading">{{ 'admin.design.preview' | transloco }}</h2>
      <p class="meta">{{ 'admin.design.previewHint' | transloco }}</p>
      <div class="card">
        <div class="card__brand">
          @if (logoUrl(); as url) {
            <img class="card__logo" [src]="url" alt="" />
          }
          <strong>{{ draft().organizationName }}</strong>
        </div>
        <p class="card__text">{{ 'admin.design.cardText' | transloco }}</p>
        <div class="card__actions">
          <!-- The participant client's own word for its button, so renaming it
               renames the preview too. -->
          <span class="card__button card__button--primary">
            {{ 'register.submit' | transloco }}
          </span>
          <span class="card__button card__button--accent">
            {{ 'admin.design.cardCalendar' | transloco }}
          </span>
        </div>
      </div>
    </section>

    <section aria-labelledby="images-heading">
      <h2 id="images-heading">{{ 'admin.design.images' | transloco }}</h2>
      <p class="meta">{{ 'admin.design.imagesHint' | transloco }}</p>

      <trefaro-image-upload-field
        fieldId="logo"
        [endpoint]="logoEndpoint"
        [heading]="'admin.design.logoHeading' | transloco"
        [fileLabel]="'admin.design.logoFileLabel' | transloco"
        [hint]="'admin.design.logoHint' | transloco"
        [currentUrl]="logoUrl()"
        (changed)="reread()"
      />

      <trefaro-image-upload-field
        fieldId="app-icon"
        [endpoint]="appIconEndpoint"
        [heading]="'admin.design.iconHeading' | transloco"
        [fileLabel]="'admin.design.iconFileLabel' | transloco"
        [hint]="'admin.design.iconHint' | transloco"
        [currentUrl]="appIconUrl()"
        [square]="true"
        (changed)="reread()"
      />
    </section>
  `,
  styles: `
    .head {
      max-inline-size: 44rem;
    }

    .meta {
      margin: 0.2rem 0 0;
      font-size: 0.85rem;
      color: #444;
    }

    .error,
    .status {
      max-inline-size: 44rem;
      margin-block-start: 1rem;
      padding: 0.6rem 0.8rem;
      border-radius: 0.4rem;
      font-size: 0.9rem;
    }

    .error {
      border: 1px solid #a3341f;
      color: #a3341f;
    }

    .status {
      border: 1px solid var(--trefaro-color-primary-muted);
    }

    form {
      margin-block-start: 1.5rem;
      inline-size: min(40rem, 100%);
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.9rem;
    }

    .field label {
      font-weight: 600;
    }

    input,
    select {
      padding: 0.45rem 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    input[type='color'] {
      inline-size: 4rem;
      block-size: 2.4rem;
      padding: 0.15rem;
    }

    .colours {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .actions {
      display: flex;
      gap: 0.6rem;
      margin-block-start: 1rem;
    }

    button {
      padding: 0.4rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    button[type='submit'] {
      border: 0;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }

    section {
      margin-block-start: 2rem;
      inline-size: min(44rem, 100%);
    }

    h2 {
      font-size: 1.1rem;
      margin-block-end: 0;
    }

    .readings {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin: 0.8rem 0 0;
      padding: 0;
      list-style: none;
      font-size: 0.9rem;
    }

    .readings li {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .swatch {
      inline-size: 1rem;
      block-size: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 40%, transparent);
      border-radius: 0.2rem;
    }

    .warning {
      flex-basis: 100%;
      padding: 0.4rem 0.6rem;
      border-inline-start: 3px solid #a3341f;
      color: #a3341f;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-block-start: 0.8rem;
      padding: 1rem;
      border: 1px solid var(--trefaro-color-primary-muted);
      border-radius: 0.6rem;
      background: var(--trefaro-color-primary-soft);
    }

    .card__brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.1rem;
    }

    .card__logo {
      max-block-size: 2rem;
      max-inline-size: 8rem;
    }

    .card__text {
      margin: 0;
    }

    .card__actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .card__button {
      padding: 0.4rem 0.9rem;
      border-radius: 0.4rem;
      font-weight: 600;
    }

    .card__button--primary {
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
    }

    .card__button--accent {
      background: var(--trefaro-color-accent);
      color: var(--trefaro-color-on-accent);
    }

    trefaro-image-upload-field {
      display: block;
      margin-block-start: 1.2rem;
    }
  `,
})
export class DesignPage {
  protected readonly fonts = FONT_FAMILIES;
  protected readonly maxNameLength = MAX_ORGANIZATION_NAME_LENGTH;
  protected readonly minSurfaceContrast = MIN_SURFACE_CONTRAST;
  protected readonly minDerivedTextContrast =
    MIN_DERIVED_TEXT_CONTRAST.toFixed(1);

  private readonly settings = inject(ConfigAdminService);
  private readonly config = inject(AppConfigService);
  private readonly theme = inject(ThemeService);

  /**
   * Where the two branding images go.
   *
   * Plain objects rather than signals: they close over a service, not over
   * anything that changes. The field they are handed to knows nothing about
   * configuration, which is what lets the series and event forms reuse it.
   */
  protected readonly logoEndpoint: ImageEndpoint = {
    upload: async (file) =>
      void (await this.settings.uploadImage('logo', file)),
    remove: async () => void (await this.settings.removeImage('logo')),
  };

  protected readonly appIconEndpoint: ImageEndpoint = {
    upload: async (file) =>
      void (await this.settings.uploadImage('app-icon', file)),
    remove: async () => void (await this.settings.removeImage('app-icon')),
  };

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<Problem | null>(null);
  protected readonly saved = signal(false);

  /** What the server stores, as last read. The baseline for Discard. */
  private readonly stored = signal<AppConfigSettings | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    organizationName: [
      '',
      [Validators.required, Validators.maxLength(MAX_ORGANIZATION_NAME_LENGTH)],
    ],
    primaryColor: ['#000000', Validators.pattern(HEX_COLOR_PATTERN)],
    accentColor: ['#000000', Validators.pattern(HEX_COLOR_PATTERN)],
    fontFamily: [DEFAULT_FONT_FAMILY_KEY as string],
  });

  /**
   * The form's current value as a signal, so the template and the derived
   * readings have one source instead of reading controls in three places.
   */
  protected readonly draft = signal(this.form.getRawValue());

  /** The images, from the configuration this client fetched (and re-fetches). */
  protected readonly logoUrl = computed(
    () => this.config.config()?.theme.logoUrl ?? null,
  );
  protected readonly appIconUrl = computed(
    () => this.config.config()?.appIconUrl ?? null,
  );

  /** Whether anything in the form differs from what is stored. */
  protected readonly changed = computed(() => {
    const stored = this.stored();
    if (!stored) return false;
    const baseline = toFormValue(stored);
    const current = this.draft();
    return (
      current.organizationName !== baseline.organizationName ||
      current.primaryColor !== baseline.primaryColor ||
      current.accentColor !== baseline.accentColor ||
      current.fontFamily !== baseline.fontFamily
    );
  });

  /**
   * What the legibility panel reports, recomputed as the form changes.
   *
   * Two numbers per colour, and at most one warning — for reasons worth writing
   * down, because the obvious check is the one that cannot work:
   *
   * - **Text on a brand colour** cannot fall below 4.5:1. `readableTextColor`
   *   picks black or white at the luminance where both contrast equally, so the
   *   worst case any colour can reach is {@link MIN_DERIVED_TEXT_CONTRAST} ≈
   *   4.58:1. A hint "text on your colour is too pale" would therefore never
   *   appear — and a check that cannot fire reads as a guarantee somebody is
   *   watching over. So the number is shown as a fact.
   * - **The primary colour against the page** is the one nothing can decide for
   *   an organization. It is painted as a surface (the menu, a button, a tile on
   *   a white page) and it is where the link colour comes from, so a pale
   *   primary makes those shapes and those links hard to find while every piece
   *   of text on them stays perfectly readable. The threshold is 3:1 — what
   *   WCAG 2.2 asks of a user-interface component rather than of text.
   * - **The accent gets no such warning**, and that is not an oversight. It is
   *   never the surface somebody has to locate: it appears as a badge or a
   *   border *inside* something already found, always with its derived text
   *   colour on top. The one place it was a thin line on the white page — the
   *   focus ring — now uses the darkened `-strong` shade instead, which is
   *   derived and therefore always dark enough. Warning about the accent would
   *   fire on this product's own default palette and teach organizers to ignore
   *   the panel.
   */
  protected readonly readings = computed<readonly ContrastReading[]>(() => [
    reading(
      'admin.setup.primaryColor',
      this.draft().primaryColor,
      'admin.design.primaryRole',
      true,
    ),
    reading(
      'admin.setup.accentColor',
      this.draft().accentColor,
      'admin.design.accentRole',
      false,
    ),
  ]);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.draft.set(this.form.getRawValue());
      this.preview();
    });

    // Leaving the page is a discard: an unsaved colour must not follow an
    // organizer into the participant list.
    inject(DestroyRef).onDestroy(() => this.applyStoredTheme());

    void this.load();
  }

  protected ratio(value: number): string {
    return value.toFixed(1);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      const written = await this.settings.updateSettings(
        this.form.getRawValue(),
      );
      this.adopt(written);
      // Read back, so the menu shows the new name and the theme is the one the
      // server derived — the font arrives as a CSS stack, not as a key.
      await this.reread();
      this.saved.set(true);
    } catch (error: unknown) {
      this.report(error, 'admin.design.errorSave');
    } finally {
      this.busy.set(false);
    }
  }

  /** Puts the form and the document back to what the server stores. */
  protected discard(): void {
    const stored = this.stored();
    if (stored) this.form.setValue(toFormValue(stored));
    this.error.set(null);
    this.saved.set(false);
    this.applyStoredTheme();
  }

  /**
   * Re-reads the public configuration after a write.
   *
   * Also what the two upload fields call: an image is stored the moment it is
   * uploaded, and its URL carries a new `?v=` that only the server can produce.
   */
  protected async reread(): Promise<void> {
    try {
      const config = await this.config.reload();
      this.theme.apply(config.theme);
    } catch (error: unknown) {
      this.report(error, 'admin.design.errorReread');
    }
  }

  private async load(): Promise<void> {
    try {
      this.adopt(await this.settings.getSettings());
    } catch (error: unknown) {
      this.report(error, 'admin.design.errorLoad');
    } finally {
      this.loading.set(false);
    }
  }

  /** Takes the stored settings as the new baseline and shows them. */
  private adopt(settings: AppConfigSettings): void {
    this.stored.set(settings);
    this.form.setValue(toFormValue(settings));
  }

  /** Writes the draft theme onto this document — the preview (E20). */
  private preview(): void {
    if (this.form.controls.primaryColor.invalid) return;
    if (this.form.controls.accentColor.invalid) return;
    this.theme.apply(this.draftTheme());
  }

  private applyStoredTheme(): void {
    const config = this.config.config();
    if (config) this.theme.apply(config.theme);
  }

  private draftTheme(): Theme {
    const value = this.draft();
    return {
      primaryColor: value.primaryColor,
      accentColor: value.accentColor,
      // The font is stored as a catalogue key and rendered as a stack; the
      // preview has to do the same expansion the server does for `/api/config`.
      fontFamily: fontFamilyStack(value.fontFamily),
      // Not part of the form: an image is written when it is uploaded, so what
      // is stored is also what should be previewed.
      logoUrl: this.logoUrl(),
    };
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}

function reading(
  labelKey: string,
  color: string,
  roleKey: string,
  surface: boolean,
): ContrastReading {
  const onPage = contrastRatio(color, PAGE_BACKGROUND_COLOR);
  return {
    labelKey,
    color,
    onColor: contrastRatio(color, readableTextColor(color)),
    onPage,
    roleKey,
    surface,
    tooPale: surface && onPage < MIN_SURFACE_CONTRAST,
  };
}

/**
 * The stored settings as the form holds them.
 *
 * The one conversion: a colour is expanded to six digits. `#fff` is a valid
 * stored value (E17 accepts both notations), but `<input type="color">` accepts
 * only `#rrggbb` — hand it a shorthand and it silently shows black, and writes
 * that black back into the form the moment the picker is opened. Expanding on
 * the way in means the control always holds what the element can render, and
 * what goes back to the server is the same colour.
 */
function toFormValue(settings: AppConfigSettings): {
  organizationName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
} {
  return {
    organizationName: settings.organizationName,
    primaryColor: expandHex(settings.primaryColor),
    accentColor: expandHex(settings.accentColor),
    fontFamily: settings.fontFamily,
  };
}

function expandHex(color: string): string {
  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (!shorthand) return color.toLowerCase();
  const [, r, g, b] = shorthand;
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}
