/**
 * Readable identifiers for public URLs.
 *
 * A shared link should say what it points at — `/series/klimakonferenz-2027`
 * rather than a UUID — so every publicly addressable thing carries a slug
 * alongside its id. Used by event series and, from AP 3, by events.
 *
 * German is transliterated rather than stripped: "Bürgerräte" has to become
 * `buergerraete`, not `brgerrte`. Other diacritics are decomposed and dropped,
 * which is the conventional behaviour and keeps the result typeable.
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
  ß: 'ss',
};

/** Long enough for a real title, short enough to stay a URL. */
export const MAX_SLUG_LENGTH = 80;

/** Whether a slug is usable as it stands. */
export function isSlug(value: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= MAX_SLUG_LENGTH
  );
}

/**
 * Turns a title into a slug, or into `''` when nothing usable is left — which
 * happens for a name written entirely in a non-Latin script. The caller decides
 * what to fall back to; it must not guess a name.
 */
export function slugify(value: string): string {
  return [...value]
    .map((character) => TRANSLITERATIONS[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}
