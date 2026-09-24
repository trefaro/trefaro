import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * What a log line may say about a person — checked mechanically (NFR 11, NFR 7).
 *
 * AP 10 of phase 5 asks that an operator can tell from the logs what went
 * wrong **without finding an address in them**, and that is two different
 * sentences. The first one is about what the log says; the second is a rule
 * that holds only as long as somebody re-reads sixty call sites. So it is a
 * test instead.
 *
 * The rule: a log line names a row by its **id**, never by the person behind
 * it. An id is meaningless outside this instance's database, which is exactly
 * what makes it safe to paste into an issue, a support mail or a monitoring
 * system — and an operator who needs the person looks the id up, in the
 * application, where the lookup is an authorised read rather than a side
 * effect of a stack trace.
 *
 * This reads the source as text, like `plugins/plugin-schema.spec.ts`, and for
 * the same reason: what is under test is a sentence about a template literal,
 * and the template is in the file whether or not anything runs.
 *
 * **What it cannot see**, named so nobody mistakes a green run for a proof:
 * a sentence assembled somewhere else and handed to the logger as a variable
 * (`Logger.warn(warning, 'Smtp')` in `main.ts` is one), and anything a library
 * prints on its own. Those have unit tests of their own — `smtp.spec.ts`,
 * `rate-limits.spec.ts` — and the request URL, the one place where a caller
 * could put an address into a log line from outside, is redacted before it is
 * logged (`core/filters/all-exceptions.filter.ts`).
 */

const SOURCE_ROOTS = [resolve(__dirname), resolve(__dirname, '..', 'plugins')];

/** The calls this scan reads. `verbose` is in for completeness; nothing uses it. */
const LOG_CALL =
  /(?:^|[^\w.])(?:this\.)?(?:logger|Logger)\.(log|warn|error|debug|verbose)\(/g;

/**
 * Names that make an interpolation a person rather than a row.
 *
 * Deliberately short. A broad list — `name` would catch `template.name`,
 * `plugin.key` and the organization's own name — gets exceptions added to it
 * carelessly, and a guard with a long exception list guards nothing. Each
 * entry below is here for a stated reason:
 *
 * - an **address** is the one value in this schema that identifies a person
 *   outside it, and it is the word the acceptance criterion uses;
 * - a **given or family name** is the person themselves;
 * - a **credential** — password, hash, secret, token — is not personal data
 *   but is worse: a log that carries one is a log that grants access;
 * - an **address of a device** and its user agent identify somebody as
 *   reliably as their name does, and nothing logs one today. The entry is
 *   what keeps it that way;
 * - a **search term** is typed by an organizer and is, in the one screen that
 *   has a search box, somebody's surname (F32).
 */
const PERSONAL: readonly { readonly pattern: RegExp; readonly what: string }[] =
  [
    { pattern: /email/i, what: 'an address' },
    { pattern: /first_?name|last_?name|full_?name/i, what: 'a person’s name' },
    { pattern: /password|secret|token/i, what: 'a credential' },
    { pattern: /\bip\b|ipAddress|userAgent/i, what: 'a device' },
    { pattern: /searchTerm|\bterms?\b/i, what: 'a search term' },
  ];

/**
 * The exceptions, each with the reason it is one.
 *
 * `file: expression`, spelled exactly as the source spells it. One entry —
 * which is the number an exception list is allowed to have before it needs an
 * argument of its own.
 */
const ALLOWED: readonly string[] = [
  // The first-run setup token (E28, F102). It is printed *so that* somebody
  // reads it off the console and pastes it into the organizer client, and it
  // opens exactly one door: the setup screen, and only while `admin_user` is
  // still empty. A log that hid it would leave an instance with no way in.
  'app/business/setup/setup.service.ts: this.tokens.issue()',
];

function sourceFiles(root: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      found.push(path);
    }
  }
  return found.sort();
}

/** The text of one call's arguments, from the open paren to its match. */
function argumentsOf(source: string, openParen: number): string {
  let depth = 0;
  for (let index = openParen; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen + 1, index);
    }
  }
  return source.slice(openParen + 1);
}

interface Interpolation {
  readonly file: string;
  readonly expression: string;
}

/** Every `${…}` this file hands to a logger, with nothing else around it. */
function interpolationsLogged(
  file: string,
  source: string,
): readonly Interpolation[] {
  const found: Interpolation[] = [];
  for (const call of source.matchAll(LOG_CALL)) {
    const args = argumentsOf(source, call.index + call[0].length - 1);
    for (const match of args.matchAll(/\$\{([^}]*)\}/g)) {
      found.push({ file, expression: match[1].trim().replace(/\s+/g, ' ') });
    }
  }
  return found;
}

describe('what the server writes to its log', () => {
  const files = SOURCE_ROOTS.flatMap(sourceFiles);
  const interpolations = files.flatMap((file) =>
    interpolationsLogged(
      relative(resolve(__dirname, '..'), file).replaceAll('\\', '/'),
      readFileSync(file, 'utf8'),
    ),
  );

  it('is written in enough places for this scan to be worth running', () => {
    // Guards the scan itself: an expression that stopped matching would make
    // the assertion below pass over an empty list.
    expect(files.length).toBeGreaterThan(200);
    expect(interpolations.length).toBeGreaterThan(30);
  });

  it('names a row by its id and never the person behind it', () => {
    const offenders = interpolations
      .filter(
        ({ file, expression }) => !ALLOWED.includes(`${file}: ${expression}`),
      )
      .flatMap(({ file, expression }) =>
        PERSONAL.filter(({ pattern }) => pattern.test(expression)).map(
          ({ what }) => `${file} logs ${what}: \${${expression}}`,
        ),
      );

    expect(offenders).toEqual([]);
  });

  it('still has the one exception it declares, and no more', () => {
    // An allow-list whose entry no longer matches anything is a comment. This
    // fails when the setup token stops being printed — at which point the
    // entry above should go, not this test.
    const declared = interpolations.filter(({ file, expression }) =>
      ALLOWED.includes(`${file}: ${expression}`),
    );
    expect(declared).toHaveLength(ALLOWED.length);
  });
});
