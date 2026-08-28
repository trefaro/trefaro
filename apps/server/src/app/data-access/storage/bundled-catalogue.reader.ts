import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { TranslationCatalogue } from '@trefaro/shared-models';
import type { ShippedCatalogueReader } from '../../business/i18n/ports/shipped-catalogue.reader';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/** File extension of a shipped catalogue. */
const SUFFIX = '.json';

/**
 * The catalogues baked into the image, read from disk (E22).
 *
 * Data access, like the upload volume: what the business layer asks for is "the
 * shipped German text", not a path. The files come from
 * `libs/shared-i18n/catalogues` — copied into `dist/apps/server/assets/i18n` by
 * the server build and from there into the image, where `I18N_CATALOGUE_DIR`
 * points at them. In development the default points straight at the library, so
 * editing a catalogue needs no build.
 *
 * **Cached for the lifetime of the process, deliberately.** These files cannot
 * change while a container runs: they are part of the image. An instance's own
 * changes are rows in `translation_override` and are read on every request —
 * that is the half that has to be fresh, and it is the half a cache here would
 * not touch.
 *
 * A malformed or unreadable file is logged and treated as absent rather than
 * thrown: the resolution chain ends in English (E23), and a broken German file
 * should cost an instance its German, not its start-up.
 */
@Injectable()
export class BundledCatalogueReader implements ShippedCatalogueReader {
  private readonly logger = new Logger(BundledCatalogueReader.name);
  private readonly directory: string;
  private readonly cache = new Map<string, TranslationCatalogue | null>();
  private discovered: readonly string[] | null = null;

  constructor(@Inject(ENV) env: TrefaroEnv) {
    this.directory = resolve(env.i18nCatalogueDir);
  }

  async locales(): Promise<readonly string[]> {
    if (this.discovered) return this.discovered;

    try {
      const entries = await readdir(this.directory);
      this.discovered = entries
        .filter((entry) => extname(entry) === SUFFIX)
        .map((entry) => basename(entry, SUFFIX))
        .sort();
    } catch (error: unknown) {
      // Worth a warning rather than silence: an instance with no shipped
      // catalogue answers every locale with an empty object, and both clients
      // then render their keys. That is a deployment fault, not a translation
      // one, and the log is where the operator will look.
      this.logger.error(
        `No translation catalogues in ${this.directory} (${describe(error)}). ` +
          'Set I18N_CATALOGUE_DIR to the directory holding en.json.',
      );
      this.discovered = [];
    }

    return this.discovered;
  }

  async read(locale: string): Promise<TranslationCatalogue | null> {
    const cached = this.cache.get(locale);
    if (cached !== undefined) return cached;

    const catalogue = await this.load(locale);
    this.cache.set(locale, catalogue);
    return catalogue;
  }

  private async load(locale: string): Promise<TranslationCatalogue | null> {
    // The caller has already established that this is a well-formed language
    // tag, but a path is built from it either way — so it is checked here too,
    // where the file system is. A tag can only ever be letters, digits and
    // hyphens, which makes traversal unrepresentable rather than filtered.
    if (!/^[A-Za-z0-9-]+$/.test(locale)) return null;

    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.directory, `${locale}${SUFFIX}`), 'utf8'),
      );
      return flat(raw);
    } catch (error: unknown) {
      if (isMissingFile(error)) return null;
      this.logger.error(
        `The shipped catalogue for ${locale} could not be read: ${describe(error)}`,
      );
      return null;
    }
  }
}

/**
 * Keeps the string entries of a parsed catalogue and drops the rest.
 *
 * The catalogues are flat by convention and a test enforces it, but this is the
 * boundary where a file becomes data — and a nested object arriving here would
 * otherwise reach a client as `[object Object]`.
 */
function flat(raw: unknown): TranslationCatalogue {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
