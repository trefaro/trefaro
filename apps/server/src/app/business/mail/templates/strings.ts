import type { TranslationCatalogue } from '@trefaro/shared-models';
import { escapeHtml, type Html } from './html';

/** What a template may put in place of a `{{placeholder}}` in plain text. */
export type TextParams = Readonly<Record<string, string | number>>;

/**
 * The same, for a body — every value already safe (see {@link Html}).
 *
 * A plain string is not accepted on purpose: the value that goes into a mail is
 * a participant's name, an organizer's paragraph or a URL, and the type is what
 * makes forgetting {@link escapeHtml} a compile error rather than a defect that
 * only the one mail with an apostrophe in it reveals.
 */
export type HtmlParams = Readonly<Record<string, Html>>;

/**
 * One language's words for one mail, ready to render.
 *
 * Deliberately not "the catalogue": a template is handed exactly the keys it
 * declared and the language they were resolved in, so it cannot reach for a key
 * that E24's whole-mail check never looked at.
 */
export interface MailStrings {
  /** The language this mail is actually written in — after E24 has decided. */
  readonly locale: string;
  /** A line of plain text. */
  text(key: string, params?: TextParams): string;
  /** The same line for the HTML part, with the catalogue text escaped. */
  html(key: string, params?: HtmlParams): Html;
}

/** Raised when the image cannot write a mail at all — see {@link mailStrings}. */
export class MissingMailTextError extends Error {
  constructor(
    readonly locale: string,
    readonly keys: readonly string[],
  ) {
    super(
      `the ${locale} catalogue is missing mail text for: ${keys.join(', ')}`,
    );
    this.name = 'MissingMailTextError';
  }
}

/**
 * Binds resolved text to the two renderings a mail needs.
 *
 * `values` has to cover `keys` — this is the end of the resolution, not another
 * link in it. A gap here means the image ships an English catalogue without a
 * key some template asks for, which is a broken build rather than a missing
 * translation, so it throws instead of quietly writing the key into a letter.
 * `mail-text.spec.ts` is what keeps it unreachable.
 */
export function mailStrings(
  locale: string,
  keys: readonly string[],
  values: TranslationCatalogue,
): MailStrings {
  const missing = keys.filter((key) => typeof values[key] !== 'string');
  if (missing.length > 0) throw new MissingMailTextError(locale, missing);

  return {
    locale,
    text: (key, params) => interpolate(values[key], params ?? {}),
    html: (key, params) =>
      interpolate(escapeHtml(values[key]), params ?? {}) as Html,
  };
}

/**
 * Fills `{{ name }}` placeholders, and leaves the ones nobody supplied.
 *
 * Left rather than emptied, which is the opposite of what Transloco does in the
 * clients — and on purpose. An organization may write `{{tage}}` into its own
 * German text where the template supplies `days`; on a screen the empty gap is
 * fixed by the next edit, but a mail has already been sent. A visible
 * `{{tage}}` is something a recipient can report and an organizer can find.
 *
 * The escaping of the catalogue text happens before this, never after: the
 * placeholder syntax has no HTML-significant characters, so it survives
 * escaping intact, while a parameter inserted first would be escaped twice.
 */
function interpolate(
  template: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (placeholder, name) =>
    name in params ? String(params[name]) : placeholder,
  );
}
