import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The words this client is expected to render, read from the catalogue it ships
 * (AP 8 of phase 2).
 *
 * A browser test that asserted `getByRole('button', { name: 'Register' })`
 * asserts two things at once — that the button is there, and that the English
 * catalogue says "Register". The second one is the organization's to change: a
 * wording it corrects in the language administration must not fail a test. So
 * every assertion here names a **key**, and the expected text is looked up.
 *
 * That also turns every one of them into a check that the key resolves at all: a
 * key with no entry renders as itself, and `t()` would then be comparing
 * `'register.submit'` against a button labelled `register.submit`… which is why
 * {@link expectNoRawKeys} exists as well.
 *
 * Read from disk, not imported: these are the files the server serves and the
 * image copies, and a test that went through a bundler would prove something
 * about the bundle instead.
 */
const CATALOGUE_DIR = findCatalogueDir();

/**
 * The catalogue directory, found by walking up from the working directory.
 *
 * Playwright runs with the *project* as its working directory, Vitest with the
 * workspace root, and this file is loaded by a TypeScript loader rather than
 * bundled — so neither a fixed relative path nor `process.cwd()` alone is right
 * everywhere it might be read from.
 */
function findCatalogueDir(): string {
  let directory = process.cwd();
  for (;;) {
    const candidate = join(directory, 'libs', 'shared-i18n', 'catalogues');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('No shipped catalogues above ' + process.cwd());
    }
    directory = parent;
  }
}

const catalogues = new Map<string, Readonly<Record<string, string>>>();

function catalogue(locale: string): Readonly<Record<string, string>> {
  const cached = catalogues.get(locale);
  if (cached) return cached;

  const parsed = JSON.parse(
    readFileSync(join(CATALOGUE_DIR, `${locale}.json`), 'utf8'),
  ) as Record<string, string>;
  catalogues.set(locale, parsed);
  return parsed;
}

/**
 * What a key says in a language, with its placeholders filled in.
 *
 * Throws on a key the catalogue does not have, rather than returning the key:
 * a test that silently compared a key against a key would pass while the page
 * showed nothing a reader could use.
 */
export function t(
  key: string,
  params: Readonly<Record<string, string | number>> = {},
  locale = 'en',
): string {
  const text = catalogue(locale)[key];
  if (text === undefined) {
    throw new Error(`No ${locale} translation for "${key}"`);
  }
  return Object.entries(params).reduce(
    (filled, [name, value]) => filled.replaceAll(`{{${name}}}`, String(value)),
    text,
  );
}

/**
 * A translation key rendered where a sentence belongs.
 *
 * A missing key renders as itself (`missingHandler.allowEmpty: false`), so this
 * is what an extraction mistake looks like on a screen — a key nobody translated,
 * a key spelled two ways, a catalogue that never arrived. Matching whole text
 * nodes rather than substrings: a domain in a link's text
 * (`files.example.org`) has the same shape as a key, and it is never a node of
 * its own the way an unresolved key always is.
 */
export async function expectNoRawKeys(page: Page): Promise<void> {
  const raw = await page.evaluate(() => {
    const pattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const found: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      if (pattern.test(text)) found.push(text);
    }
    return found;
  });

  expect(raw, 'untranslated keys on the page').toEqual([]);
}
