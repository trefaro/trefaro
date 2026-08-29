import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { canonicalLocaleTag } from '@trefaro/shared-models';

/**
 * `?locale=` on a public read endpoint (E25).
 *
 * In the query and not in `Accept-Language`, deliberately: a link somebody
 * shares, a page a proxy caches and a screenshot in a bug report all have to
 * show the same thing, and a header that varies per reader makes one URL mean
 * several pages. It is also the only form an organizer can paste into a mail.
 *
 * Three answers, and the middle one is the interesting one:
 *
 * - **Absent or empty → `undefined`.** The originals, exactly as before AP 11.
 *   Query parameters arrive as `undefined` whatever a client's default says, so
 *   this is the ordinary case and it costs no lookup.
 * - **A well-formed tag nobody has translated into → that tag.** Not an error:
 *   `?locale=fr` on an instance that has stopped offering French must still
 *   render the page, in the originals. A translation that does not exist and a
 *   language that does not exist are the same fact to a reader, and a link in
 *   somebody's mail from last year is exactly where this comes up.
 * - **Anything that is not a language tag → 400.** `de_DE`, `deutsch`, a
 *   sentence: nothing but a broken caller produces those, and answering them
 *   with the English page would hide the bug behind a page that looks right.
 *
 * Lower-cased on the way through, so `de-AT` and `de-at` reach one set of rows.
 */
@Injectable()
export class LocaleQueryPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;

    const tag = canonicalLocaleTag(value);
    if (tag === null) {
      throw new BadRequestException(
        'locale must be a BCP 47 language tag such as de or de-AT',
      );
    }
    return tag;
  }
}

/**
 * The OpenAPI half of {@link LocaleQueryPipe}, so the two cannot drift.
 *
 * Every endpoint that takes the pipe takes this, and one sentence describes the
 * parameter for all of them — the alternative is five copies of a paragraph,
 * four of which stop being true on the next change.
 */
export function ApiLocaleQuery(): MethodDecorator {
  return ApiQuery({
    name: 'locale',
    required: false,
    description:
      'Renders the content in this language wherever a translation exists, and ' +
      'in the original everywhere else (FR 3.12, E25). A language nobody has ' +
      'translated into is not an error — a link somebody shared last year has ' +
      'to keep working. Anything that is not a language tag is a 400.',
    example: 'de',
  });
}
