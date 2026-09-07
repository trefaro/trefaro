/**
 * The icons this version draws, as a closed catalogue (E49).
 *
 * Names are Material Symbols names, and they are the only ones anything may
 * ask for: a plug-in descriptor's `icon`, a tile, a navigation entry. The glyph
 * data behind each name is TypeScript in `@trefaro/shared-theming` — the same
 * division as the fonts, where the keys an organization can pick live here and
 * the files live there (E18).
 *
 * **No entry without its glyph, and no glyph without its entry.** The path data
 * is typed as `Record<IconName, string>`, so the compiler refuses a name with
 * no path and a path with no name — the fonts need a test for that because a
 * stylesheet is not typed; here it is the type.
 *
 * The set is closed on purpose, and the reasons are in order: an icon font
 * would be a second font machinery with ligatures and a loading state, a
 * `<use>` into a sprite file would be one more request from a page that
 * promises none (NFR 9), and an upload would be a design decision handed to
 * whoever names it. Path data costs a few hundred bytes in the bundle and
 * `currentColor` does what it should.
 *
 * A name that is not in here gets **no** icon — never a placeholder and never
 * an error that stops a page. The module administration is where a descriptor's
 * unknown name is reported, because that is where plug-in problems already are.
 */
export const ICON_NAMES = [
  /** Programme of an event — the participant's timeline tile. */
  'event',
  /** A personal selection of sessions (FR 3.17). */
  'event_note',
  /** Discussion forum (FR 4.6). */
  'forum',
  /** Programme proposals (FR 3.13) — a suggestion, not a booking. */
  'lightbulb',
  /** External media of an event, which are linked and never embedded. */
  'link',
  /** Room planning (FR 3.11). */
  'meeting_room',
  /** QR check-in (FR 3.16). */
  'qr_code_2',
] as const;

/** One of the names {@link ICON_NAMES} offers. */
export type IconName = (typeof ICON_NAMES)[number];

/**
 * Whether this version can draw the named icon.
 *
 * Takes `unknown` because the interesting callers hold a value from outside the
 * compiler's reach: a plug-in descriptor's `icon` arrives over HTTP.
 */
export function isIconName(value: unknown): value is IconName {
  return (
    typeof value === 'string' &&
    (ICON_NAMES as readonly string[]).includes(value)
  );
}
