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
}
