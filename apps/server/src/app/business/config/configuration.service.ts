import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  AppConfig,
  AppConfigChange,
  AppConfigSettings,
  LocaleSettings,
} from '@trefaro/shared-models';
import {
  MAX_ACTIVE_LOCALES,
  MAX_ORGANIZATION_NAME_LENGTH,
  PUSH_MODULE_KEY,
  fontFamilyStack,
  isFontFamilyKey,
  isHexColor,
  isLocaleTag,
} from '@trefaro/shared-models';
import { ENV } from '../../core/config/env.module';
import { brandingImageUrls } from './branding-url';
import type { TrefaroEnv } from '../../core/config/env';
import { PluginRegistryService } from '../plugin-manager';
import { CoreModuleRegistryService } from './core-module-registry.service';
import {
  APP_CONFIG_REPOSITORY,
  type AppConfigRecord,
  type AppConfigRepository,
} from './ports/app-config.repository';

/**
 * Assembles the configuration both clients fetch, and writes the part of it an
 * administrator owns (FR 1.4).
 *
 * Both sides in one service on purpose: the rules that decide whether a colour
 * may be stored are the same rules that make the payload safe to render, and
 * splitting them would put the second copy somewhere it can drift.
 *
 * This is the first request either client makes (client start sequence): theme
 * first, then the plug-in web components. It answers without a login, because
 * the participant start page and the event landing page are public — so nothing
 * privacy-sensitive may enter this payload.
 *
 * Which modules are enabled comes from {@link CoreModuleRegistryService} rather
 * than from the table directly, so this payload and the guard in front of an
 * optional module's endpoints answer from the same state (F53). Two readers of
 * the same flag, one cached and one not, would disagree for as long as the
 * refresh interval — and a client would then be told about a module whose API
 * answers 404.
 */
@Injectable()
export class ConfigurationService {
  constructor(
    @Inject(APP_CONFIG_REPOSITORY)
    private readonly appConfig: AppConfigRepository,
    @Inject(ENV) private readonly env: TrefaroEnv,
    private readonly plugins: PluginRegistryService,
    private readonly coreModules: CoreModuleRegistryService,
  ) {}

  async getAppConfig(): Promise<AppConfig> {
    const config = await this.appConfig.load();
    const enabledModules = this.coreModules.enabledKeys();
    // Built in one place for both images, because a stored path never appears in
    // a URL (E19) and the version has to be the same in both.
    const { logoUrl, appIconUrl } = brandingImageUrls(config);

    return {
      organizationName: config.organizationName,
      theme: {
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        logoUrl,
        // The stored value is a catalogue key; the clients need the CSS stack.
        // Expanded here rather than in each client, so `--trefaro-font-family`
        // cannot mean two different things in two apps (E18).
        fontFamily: fontFamilyStack(config.fontFamily),
      },
      defaultLocale: config.defaultLocale,
      availableLocales: config.availableLocales,
      enabledModules,
      plugins: this.plugins.enabledClientDescriptors(),
      // Handing the public key to the client saves it a second round trip before
      // it can subscribe to push; the private key never leaves the server.
      //
      // Withheld while the module is off (E21): a client that has the key offers
      // a subscription, and the endpoint that would store it answers 404. Two
      // conditions rather than one, because they say different things — the
      // module is what the organization decided, the key pair is what the
      // deployment provided.
      webPushPublicKey: this.coreModules.isEnabled(PUSH_MODULE_KEY)
        ? (this.env.webPush?.publicKey ?? null)
        : null,
      // From the environment, not the database: only the deployment knows the
      // address the outside world uses, and the organizer client — a different
      // origin — cannot derive it.
      publicUserClientUrl: this.env.publicUserClientUrl,
      appIconUrl,
    };
  }

  /**
   * The four values the design page edits (FR 1.4).
   *
   * Not `getAppConfig()` with fields removed: this answer is what an
   * administrator may *write*, and it carries the font as the stored key rather
   * than as the expanded stack — a `<select>` needs the key it will send back.
   */
  async getSettings(): Promise<AppConfigSettings> {
    return toSettings(await this.appConfig.load());
  }

  /**
   * Writes what was sent, after checking it here as well as in the DTO.
   *
   * The DTO is the outer wall, not the only one: a seed script, a future import
   * or a plug-in would reach this service without passing a controller. Both
   * rules are product decisions and belong in this layer —
   *
   * - **colours are hexadecimal** (E17), because `readableTextColor` decides
   *   black or white text from the value and falls back to white for anything it
   *   cannot parse. A stored `oklch()` renders and takes an unreadable button
   *   with it;
   * - **the font is a key of the bundled catalogue** (E18), because a family
   *   this instance does not serve resolves to the fallback in the browser and
   *   looks like a typographic opinion rather than a bug.
   */
  async updateSettings(change: AppConfigChange): Promise<AppConfigSettings> {
    // Assembled field by field, so the port never sees a value that was not
    // checked. `AppConfigChange` is readonly for its callers; here it is being
    // built, which is the one place a mutable view of it is right.
    const sanitized: WritableChange = {};

    if (change.organizationName !== undefined) {
      const name = change.organizationName.trim();
      if (name.length === 0 || name.length > MAX_ORGANIZATION_NAME_LENGTH) {
        throw new BadRequestException(
          `organizationName must be between 1 and ${MAX_ORGANIZATION_NAME_LENGTH} characters`,
        );
      }
      sanitized.organizationName = name;
    }

    for (const key of ['primaryColor', 'accentColor'] as const) {
      const value = change[key];
      if (value === undefined) continue;
      if (!isHexColor(value)) {
        throw new BadRequestException(
          `${key} must be a hexadecimal colour such as #1f6f5c`,
        );
      }
      // Lower-cased so the stored value is canonical: `#ABC` and `#abc` are the
      // same colour, and an `<input type="color">` sends the lower-cased form
      // anyway. Two spellings of one colour would only ever be a diff.
      sanitized[key] = value.toLowerCase();
    }

    if (change.fontFamily !== undefined) {
      if (!isFontFamilyKey(change.fontFamily)) {
        throw new BadRequestException(
          'fontFamily must be one of the fonts this instance ships',
        );
      }
      sanitized.fontFamily = change.fontFamily;
    }

    return toSettings(await this.appConfig.save(sanitized));
  }

  /**
   * Sets the language a fresh instance runs in (FR 1.1, AP 5).
   *
   * The first-run setup's own writer, beside {@link setLocales} — and not part of
   * {@link updateSettings}: the design page must not be
   * able to change the language of every outgoing mail by sending one more field
   * (E20 makes that invisible until the next reload), and the set of legal
   * values is decided elsewhere — by which mail templates this image ships,
   * which is knowledge of the mail module. `ConfigurationModule` cannot ask it:
   * the mail module reads this configuration, so the dependency runs the other
   * way and asking back would close the circle. The caller — the setup module,
   * which sits above both — checks the value against that catalogue; what is
   * checked here is the shape and the column's bound, so nothing unstorable or
   * unformattable can be written by a seed script or a later import.
   *
   * English is kept in `active_locales` whatever is chosen: NFR 4 makes it
   * mandatory beside the national language, and the column has a `CHECK` that it
   * is never empty.
   */
  async setDefaultLocale(locale: string): Promise<void> {
    const canonical = canonicalLocale(locale, 'defaultLocale');
    await this.appConfig.setLocales({
      defaultLocale: canonical,
      activeLocales:
        canonical === FALLBACK_UI_LOCALE
          ? [FALLBACK_UI_LOCALE]
          : [FALLBACK_UI_LOCALE, canonical],
    });
  }

  /**
   * Which languages this instance offers, and which one it defaults to.
   *
   * A reader of its own rather than a slice of {@link getAppConfig}: the language
   * administration and the mail module both want these two values and nothing
   * else, and the public payload also carries the theme, the enabled modules and
   * the plug-in descriptors.
   */
  async getLocaleSettings(): Promise<LocaleSettings> {
    const config = await this.appConfig.load();
    return {
      defaultLocale: config.defaultLocale,
      activeLocales: config.availableLocales,
    };
  }

  /**
   * Sets the languages the organization offers (FR 1.4, AP 7).
   *
   * Written as a set, because the two values constrain each other: the default
   * has to be one of the offered ones, and a pair of endpoints would have a
   * moment between them in which it is not. The rules enforced here:
   *
   * - **English stays** (NFR 4). It is added if it was left out rather than
   *   refused: the column has a `CHECK` that it is never empty, English is the
   *   last link of the resolution chain (E23), and an organization that removed
   *   it would leave every untranslated key with nothing to fall back to.
   * - **The default is one of them.** Refused rather than corrected — which
   *   language a first-time visitor sees and every mail goes out in is too
   *   consequential to be inferred from a mistake.
   * - **Nothing about translations.** Offering a language that is barely
   *   translated is allowed on purpose (E23): a client falls back per key, and
   *   the language administration shows the figure beside the switch. And
   *   removing one deletes no row (E30) — the work stays for the next attempt.
   */
  async setLocales(change: LocaleSettings): Promise<LocaleSettings> {
    const requested = change.activeLocales.map((locale) =>
      canonicalLocale(locale, 'activeLocales'),
    );
    // Deduplicated in the order it was sent, so the `<select>` in both clients
    // keeps the order an organizer chose.
    const active = [...new Set([FALLBACK_UI_LOCALE, ...requested])];

    if (active.length > MAX_ACTIVE_LOCALES) {
      throw new BadRequestException(
        `activeLocales must not contain more than ${MAX_ACTIVE_LOCALES} languages`,
      );
    }

    const defaultLocale = canonicalLocale(
      change.defaultLocale,
      'defaultLocale',
    );
    if (!active.includes(defaultLocale)) {
      throw new BadRequestException(
        'defaultLocale must be one of the active locales',
      );
    }

    const record = await this.appConfig.setLocales({
      defaultLocale,
      activeLocales: active,
    });

    return {
      defaultLocale: record.defaultLocale,
      activeLocales: record.availableLocales,
    };
  }
}

/**
 * One well-formed, storable, lower-cased tag — or a 400 naming the field.
 *
 * The shape check lives in `shared-models` (`isLocaleTag`), because the catalogue
 * endpoint and the language administration ask the same question and a second
 * pattern here would be a second answer. What stays here is the message: a
 * request that is refused should say which value was wrong.
 */
function canonicalLocale(locale: string, field: string): string {
  const tag = locale.trim();
  if (!isLocaleTag(tag)) {
    throw new BadRequestException(
      `${field} must be a BCP 47 language tag such as de or de-AT`,
    );
  }
  return tag.toLowerCase();
}

/**
 * The language every instance has (NFR 4), and the fallback of the mail
 * templates.
 *
 * Spelled out here rather than imported from the mail module, which would make
 * this module depend on one that depends on it.
 */
const FALLBACK_UI_LOCALE = 'en';

type WritableChange = {
  -readonly [K in keyof AppConfigChange]: AppConfigChange[K];
};

/** The writable subset of a stored row, in one place for both readers. */
function toSettings(record: AppConfigRecord): AppConfigSettings {
  return {
    organizationName: record.organizationName,
    primaryColor: record.primaryColor,
    accentColor: record.accentColor,
    fontFamily: record.fontFamily,
  };
}
