import type { TranslationCatalogue } from '@trefaro/shared-models';

/**
 * Port for the catalogues that travel inside the image (E22).
 *
 * A port and not an `import`, twice over. Files are data access — the same rule
 * that put the upload volume behind `FileStore` (E9): the business layer knows
 * *that* the shipped text exists, not where on disk it sits or that a disk is
 * involved. And the alternative, importing `libs/shared-i18n/catalogues/en.json`
 * into a service, would make client text part of the contract layer the server
 * compiles against; `apps/server` depends on `@trefaro/shared-models` and
 * nothing else shared, and that boundary is worth more than the convenience.
 *
 * Everything behind this port is immutable for the lifetime of a container: the
 * files are baked into the image. That is why the implementation may cache
 * without an invalidation story, and why nothing here is asynchronous for the
 * sake of a future write — there will never be a write.
 */
export interface ShippedCatalogueReader {
  /**
   * The languages this image ships, in no promised order.
   *
   * Discovered rather than declared, because the answer is "which files are in
   * the directory" and a second declaration could disagree with it.
   */
  locales(): Promise<readonly string[]>;

  /** The shipped catalogue of a language, or `null` if this image has none. */
  read(locale: string): Promise<TranslationCatalogue | null>;
}

export const SHIPPED_CATALOGUE_READER = Symbol(
  'TREFARO_SHIPPED_CATALOGUE_READER',
);
