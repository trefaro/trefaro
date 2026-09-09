/**
 * The places a plug-in's web component may be mounted in a client.
 *
 * A **closed** set, and extending it is a contract step: plug-in API 1.2.0
 * added `event-dashboard` and `my-registration`, the last of the eight
 * extensions of that one step (E46, F186). One hook point per screen that shows
 * plug-in content — not one per screen — because a name in here is a promise
 * both clients keep: whoever adds a value builds the host side that serves it,
 * or a plug-in declares a place that never draws it.
 *
 * The two arrived in the packages that fill them rather than in the package
 * that raised the version — `event-dashboard` in AP 3 of phase 4,
 * `my-registration` in AP 8 — because a value no slot serves is exactly the
 * pretence E46 was written against.
 *
 * `my-registration` is the participant client's self-service page, and it is
 * the one hook point that is about a **single registration** rather than an
 * event: the check-in draws its code there because a core mail may carry no
 * plug-in content, so the receipt links the page and the plug-in renders on it
 * (E54, F198).
 */
export type PluginMountPoint =
  'navigation' | 'event-detail' | 'event-dashboard' | 'my-registration';

/**
 * An enabled plug-in as announced to the clients.
 *
 * The client plug-in manager reads this after loading the configuration and
 * then fetches each bundle, registers the custom element and mounts it at the
 * declared hook points.
 */
export interface PluginDescriptor {
  /** Stable plug-in key, also used as the module configuration key. */
  readonly key: string;
  readonly version: string;
  /** Translation key for the plug-in's label; the text lives in the clients. */
  readonly labelKey: string;
  /** Custom element name the bundle registers. */
  readonly elementName: string;
  /** URL the bundle is loaded from. */
  readonly bundleUrl: string;
  readonly mountPoints: readonly PluginMountPoint[];
  readonly icon: string | null;
}

/**
 * The id the plug-in slot puts on a mounted web component.
 *
 * Built here rather than in the slot, because two places need the same string:
 * the slot that mounts the element and the tile in the participant's event
 * detail view that links to it (FR 1.5). A plug-in renders inside the page it is
 * mounted on, so its tile is a jump link — and a jump link needs a target
 * neither side may spell differently.
 */
export function pluginElementId(pluginKey: string): string {
  return `plugin-${pluginKey}`;
}

/**
 * The catalogue prefix a plug-in's words live under (E48).
 *
 * Derived from the key rather than declared, because two sides have to agree on
 * it: the slot selects these keys out of the catalogue and hands them to the
 * element, and the plug-in ships them in `en.json` and `de.json` like every
 * other screen (E23). A prefix each side spelled for itself would drift on the
 * first plug-in whose key is two words.
 *
 * `lowerCamelCase` per segment, because a catalogue key is dotted
 * `lowerCamelCase` (F70) — so `room-planning` cannot spell itself and
 * `plugins.room-planning.` would not be a legal key. What keeps derivation and
 * declaration in agreement is a test over the curated descriptors: every
 * `titleKey` and `labelKey` has to sit under its own plug-in's prefix.
 */
export function pluginCataloguePrefix(pluginKey: string): string {
  const [first, ...rest] = pluginKey.split('-');
  const camel = [
    first,
    ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)),
  ].join('');
  return `plugins.${camel}.`;
}

/**
 * What every mounted plug-in element is handed, whatever the hook point (E48).
 *
 * Assigned as element properties by the slot — Angular Elements surfaces a
 * component's inputs as DOM properties, and a plug-in written without Angular
 * reads the same three. They are **reassigned** on a language switch rather
 * than the element being replaced, so a plug-in keeps whatever state it was
 * holding.
 *
 * The host hands over words, never finished sentences: {@link strings} is the
 * catalogue selection under the plug-in's own prefix, with the prefix stripped,
 * so a bundle needs no Transloco of its own and its text stays maintainable by
 * the organization like the rest of the application (E22).
 *
 * A hook point adds its own values on top — the event's id at `event-detail`,
 * for instance.
 */
export interface PluginSlotContext {
  /** The language the surrounding page is in. */
  readonly locale: string;
  /** The plug-in's own catalogue entries, keyed without the prefix. */
  readonly strings: Readonly<Record<string, string>>;
  /**
   * Which hook point is drawing this element right now.
   *
   * A plug-in declares one element and may declare several hook points, and
   * from AP 3 of phase 4 that is the normal case rather than an edge: the
   * programme proposals render a participant's panel at `event-detail` and the
   * organization's moderation section at `event-dashboard` — one bundle, two
   * audiences, two sets of routes. Only the host knows which of them it is
   * asking for.
   *
   * Supplied by the slot itself, like {@link locale} and for the same reason: a
   * hook point cannot forget it and no two of them can spell it differently.
   * The alternative — a plug-in guessing from the address in the browser's bar
   * or from which of its calls answers 401 — would make the two clients'
   * deployment part of a plug-in's contract.
   */
  readonly mountPoint: PluginMountPoint;
}
