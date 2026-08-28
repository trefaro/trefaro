/**
 * A resolved translation catalogue, as `GET /api/i18n/:locale` answers it.
 *
 * **Flat, with dotted keys** — `{"modules.push.title": "Push notifications"}`,
 * never a nested object. Three things address a single translation and all three
 * have to spell it the same way: the row in `translation_override`, the
 * completeness figure the language administration shows (AP 7), and the key in a
 * template. A nested file would turn "which key is missing" into a tree walk and
 * "which key did the organization change" into a path. Transloco flattens nested
 * catalogues on load anyway, so the flat form is what it works with regardless.
 *
 * Every value is a string. Plural forms and interpolation are Transloco's
 * `{{ }}` placeholders inside the string, not structure around it.
 */
export type TranslationCatalogue = Readonly<Record<string, string>>;

/**
 * The language every instance has, and the last link of the resolution chain
 * (E23, NFR 4).
 *
 * English is the key list: a key that does not exist in the shipped English
 * catalogue does not exist. That is what makes a partially translated language
 * usable instead of full of empty buttons — and what lets the completeness
 * figure be a figure.
 */
export const FALLBACK_LOCALE = 'en';

/**
 * Longest translation key; matches `translation_override.key`.
 *
 * Generous on purpose: a key is a path through the application
 * (`participants.overview.filters.status.confirmed`), and the alternative to a
 * long key is a short one that needs a comment.
 */
export const MAX_TRANSLATION_KEY_LENGTH = 200;

/**
 * Longest translated value.
 *
 * Bounded although the column is `text`: from AP 10 the four mail bodies live in
 * this catalogue, so the values are the longest strings an organization types
 * into the application — but a request body is still a request body.
 */
export const MAX_TRANSLATION_VALUE_LENGTH = 8000;

/**
 * The key convention, as a pattern (AP 6 of phase 2).
 *
 * Dot-separated segments in `lowerCamelCase`, from general to specific:
 * `<area>.<screen>.<element>` — `modules.mediaLinks.title`,
 * `plugins.roomPlanning.label`, `language.switcher.label`. Digits are allowed
 * inside a segment (`errors.http404`), a leading digit is not.
 *
 * Enforced rather than recommended, because the keys are data from AP 7 onward:
 * an organization's export/import round trip and the completeness figure both
 * rely on the set of keys being the set of keys, and a key with a space or a
 * trailing dot is one nobody can address twice the same way.
 */
const TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/;

/** Whether a string is a well-formed, storable translation key. */
export function isTranslationKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_TRANSLATION_KEY_LENGTH &&
    TRANSLATION_KEY_PATTERN.test(value)
  );
}
