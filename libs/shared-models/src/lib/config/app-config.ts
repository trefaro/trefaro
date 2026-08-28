import type { PluginDescriptor } from './plugin-descriptor';
import type { Theme } from './theme';

/**
 * Everything a client needs before it renders anything.
 *
 * Both clients fetch this first, apply the theme, and only then let the plug-in
 * manager load the web components of the enabled plug-ins. Publicly readable by
 * design: the participant start page and the event landing page work without a
 * login, so the theme must be available to anonymous visitors. Nothing
 * privacy-sensitive belongs in this payload.
 */
export interface AppConfig {
  /** What the instance calls itself — page titles, mails, the PWA manifest. */
  readonly organizationName: string;
  readonly theme: Theme;
  /** BCP 47 tag used when the visitor has expressed no preference. */
  readonly defaultLocale: string;
  /** Locales the organization maintains translations for; always includes English. */
  readonly availableLocales: readonly string[];
  /** Keys of the enabled core modules, e.g. `chat`, `push`. */
  readonly enabledModules: readonly string[];
  /** Only the enabled plug-ins — a disabled plug-in is invisible to the client. */
  readonly plugins: readonly PluginDescriptor[];
  /** Base64url VAPID public key, or `null` when push is not configured. */
  readonly webPushPublicKey: string | null;
  /**
   * Where the participant client answers, so the organizer client can link to a
   * public event page.
   *
   * It comes from the environment rather than from the database: the two clients
   * are separate origins behind a proxy, and only the deployment knows which
   * address the outside world uses. The organizer client cannot derive it — its
   * own origin is a different one.
   */
  readonly publicUserClientUrl: string;
  /**
   * The organization's square app icon, or `null` while none is uploaded.
   *
   * Beside `organizationName` rather than inside {@link Theme}, because nothing
   * in CSS refers to it: the theme is the set of values that become custom
   * properties, and this one is read by the PWA manifest (F20) and by the
   * preview on the design page. `null` means the shipped Trefaro icons apply —
   * they are drawn as maskable, an uploaded one is not (E26).
   */
  readonly appIconUrl: string | null;
}

/** Longest instance name; matches `app_config.organization_name`. */
export const MAX_ORGANIZATION_NAME_LENGTH = 128;

/** What a fresh instance calls itself until somebody says otherwise. */
export const DEFAULT_ORGANIZATION_NAME = 'Trefaro';

/**
 * The whitelabel settings an administrator may write (FR 1.4).
 *
 * Deliberately smaller than {@link AppConfig}: that payload also carries what
 * the deployment decides (`publicUserClientUrl`, the push key) and what other
 * tables decide (enabled modules, plug-ins). Only these four values are edited
 * on the design page.
 *
 * `fontFamily` is a key of `FONT_FAMILIES`, not a CSS stack — the clients get
 * the stack in `AppConfig.theme`. Both colours are hexadecimal (E17). The
 * locales stay out until phase 2's AP 7 gives them a language administration
 * that reads them; a settable value nothing reads looks like a feature.
 */
export interface AppConfigSettings {
  readonly organizationName: string;
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly fontFamily: string;
}

/** A `PATCH` on the settings: only what is sent gets written. */
export type AppConfigChange = Partial<AppConfigSettings>;
