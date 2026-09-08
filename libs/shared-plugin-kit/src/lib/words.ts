import { pluginCataloguePrefix } from '@trefaro/shared-models';

/** The words a slot hands a plug-in: its own catalogue keys, prefix stripped. */
export type PluginStrings = Readonly<Record<string, string>>;

export interface PluginWords {
  /**
   * One word out of what the host handed over (E48).
   *
   * The fallback is the **full key**, which is what a missing translation looks
   * like everywhere else in this application: a bundle mounted by a host that
   * predates plug-in API 1.2.0 says what it is missing instead of rendering
   * empty boxes.
   */
  readonly word: (strings: PluginStrings, key: string) => string;
  /**
   * A status as a word — `statusPending`, `statusApproved`, `statusRejected`,
   * one key per state of E51 and no fourth.
   */
  readonly statusWord: (strings: PluginStrings, status: string) => string;
}

/**
 * The words of one plug-in, bound to its catalogue namespace.
 *
 * Derived from the plug-in key rather than written out, for the reason
 * `pluginCataloguePrefix` exists — the host and the bundle must spell one
 * namespace the same way.
 */
export function wordsOf(pluginKey: string): PluginWords {
  const prefix = pluginCataloguePrefix(pluginKey);
  const word = (strings: PluginStrings, key: string): string =>
    strings[key] ?? `${prefix}${key}`;
  return {
    word,
    statusWord: (strings, status) =>
      word(
        strings,
        `status${status.charAt(0).toUpperCase()}${status.slice(1)}`,
      ),
  };
}
